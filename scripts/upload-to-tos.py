#!/usr/bin/env python3
"""
TOS 原生 API 上传脚本（不走 S3 兼容协议，纯 Python 标准库）

用法：
  python3 upload-to-tos.py <本地目录> <TOS上传路径前缀> <文件glob模式...>

环境变量：
  TOS_ACCESS_KEY - 火山引擎 AccessKey ID
  TOS_SECRET_KEY - 火山引擎 AccessKey Secret
  TOS_BUCKET     - bucket 名（默认 legis）
  TOS_REGION     - 区域（默认 cn-beijing）

示例：
  python3 upload-to-tos.py apps/electron/out releases/ "*.dmg" "*.zip" "latest-mac.yml"
"""

import sys
import os
import glob
import hashlib
import hmac
import base64
import datetime
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import quote


def sign_and_upload(local_path, bucket, remote_key, access_key, secret_key, region):
    """用 TOS 原生签名（AWS V2 兼容）上传单个文件"""
    host = f"{bucket}.tos-{region}.volces.com"
    url = f"https://{host}/{quote(remote_key)}"

    with open(local_path, 'rb') as f:
        data = f.read()

    # 签名（AWS Signature V2 兼容，TOS 原生支持）
    date = datetime.datetime.utcnow().strftime('%a, %d %b %Y %H:%M:%S GMT')
    string_to_sign = f"PUT\n\n\n{date}\nx-tos-acl:public-read\n/{bucket}/{quote(remote_key)}"
    signature = base64.b64encode(
        hmac.new(secret_key.encode(), string_to_sign.encode(), hashlib.sha1).digest()
    ).decode()

    req = Request(
        url,
        data=data,
        method='PUT',
        headers={
            'Date': date,
            'x-tos-acl': 'public-read',
            'Authorization': f'TOS {access_key}:{signature}',
        }
    )

    try:
        with urlopen(req, timeout=300) as resp:
            if resp.status == 200:
                size_mb = len(data) / 1024 / 1024
                print(f"✅ {os.path.basename(local_path)} ({size_mb:.1f} MB)")
                return True
            else:
                print(f"❌ {os.path.basename(local_path)}: HTTP {resp.status}")
                return False
    except HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')[:300]
        print(f"❌ {os.path.basename(local_path)}: HTTP {e.code} {body}")
        return False


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

    # 上传
    success = 0
    failed = 0
    for local_path in files_to_upload:
        filename = os.path.basename(local_path)
        remote_key = f"{remote_prefix}/{filename}" if remote_prefix else filename
        if sign_and_upload(local_path, bucket, remote_key, access_key, secret_key, region):
            success += 1
        else:
            failed += 1

    print(f"\n=== 结果：{success} 成功，{failed} 失败 ===")
    sys.exit(1 if failed > 0 else 0)


if __name__ == '__main__':
    main()
