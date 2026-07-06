#!/usr/bin/env python3
"""
TOS 上传脚本（使用火山引擎官方 ve-tos SDK）

CI 在运行时通过 pip install ve-tos 安装依赖。

用法：
  python3 upload-to-tos.py <本地目录> <TOS上传路径前缀> <文件glob模式...>

环境变量：
  TOS_ACCESS_KEY - 火山引擎 AccessKey ID
  TOS_SECRET_KEY - 火山引擎 AccessKey Secret
  TOS_BUCKET     - bucket 名（默认 legis）
  TOS_REGION     - 区域（默认 cn-beijing）
"""

import sys
import os
import glob

try:
    import tos
    print(f"✅ tos 包导入成功，版本: {getattr(tos, '__version__', '未知')}")
except ImportError as e:
    print(f"❌ tos 包导入失败(ImportError): {e}")
    print(f"   Python: {sys.version}")
    import subprocess
    subprocess.run([sys.executable, '-m', 'pip', 'list'])
    sys.exit(1)
except Exception as e:
    print(f"❌ tos 包初始化异常: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    local_dir = sys.argv[1]
    remote_prefix = sys.argv[2].strip('/')
    patterns = sys.argv[3:]

    access_key = os.environ.get('TOS_ACCESS_KEY', '')
    secret_key = os.environ.get('TOS_SECRET_KEY', '')
    bucket = os.environ.get('TOS_BUCKET', 'legis')
    region = os.environ.get('TOS_REGION', 'cn-beijing')
    endpoint = f'tos-{region}.volces.com'

    if not access_key or not secret_key:
        print("❌ 缺少 TOS_ACCESS_KEY 或 TOS_SECRET_KEY 环境变量")
        sys.exit(1)

    # 收集待上传文件
    files_to_upload = []
    for pattern in patterns:
        matched = glob.glob(os.path.join(local_dir, pattern))
        files_to_upload.extend(f for f in matched if os.path.isfile(f))

    if not files_to_upload:
        print(f"⚠️  目录 {local_dir} 中未找到匹配 {patterns} 的文件")
        sys.exit(1)

    print(f"=== 待上传 {len(files_to_upload)} 个文件 ===")
    for f in files_to_upload:
        size_mb = os.path.getsize(f) / 1024 / 1024
        print(f"  {os.path.basename(f)} ({size_mb:.1f} MB)")

    # 初始化 TOS 客户端（火山引擎官方 SDK）
    auth = tos.Auth(access_key, secret_key, region)
    client = tos.TosClient(auth, endpoint)

    # 上传
    success = 0
    failed = 0
    for local_path in files_to_upload:
        filename = os.path.basename(local_path)
        remote_key = f"{remote_prefix}/{filename}" if remote_prefix else filename
        size_mb = os.path.getsize(local_path) / 1024 / 1024

        print(f"\n→ 上传 {filename} ({size_mb:.1f} MB)...", flush=True)
        try:
            # 大文件（>5MB）用文件流避免内存爆掉
            with open(local_path, 'rb') as f:
                client.put_object(
                    Bucket=bucket,
                    Key=remote_key,
                    Body=f,
                    ACL='public-read',
                    ContentType='application/octet-stream',
                )
            print(f"  ✅ 成功")
            success += 1
        except tos.exceptions.TosClientError as e:
            print(f"  ❌ 客户端错误: {e}")
            failed += 1
        except tos.exceptions.TosServerError as e:
            print(f"  ❌ 服务器错误: code={e.code} message={e.message} request_id={e.request_id}")
            failed += 1
        except Exception as e:
            print(f"  ❌ 异常: {type(e).__name__}: {e}")
            failed += 1

    print(f"\n=== 结果：{success} 成功，{failed} 失败 ===")
    sys.exit(1 if failed > 0 else 0)


if __name__ == '__main__':
    main()
