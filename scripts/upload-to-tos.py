#!/usr/bin/env python3
"""
TOS 原生 API 上传脚本（不走 S3 兼容协议）

用 curl 子进程上传（比 urllib 更稳定，支持重试，处理大文件更好）

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
import hashlib
import hmac
import base64
import datetime
import subprocess
import time
from urllib.parse import quote


def sign_v2(method, bucket, key, access_key, secret_key, region, content_type=''):
    """生成 TOS 原生 API 的 HMAC-SHA1 签名（AWS Signature Version 2 兼容）"""
    host = f"{bucket}.tos-{region}.volces.com"
    url = f"https://{host}/{quote(key)}"

    date = datetime.datetime.utcnow().strftime('%a, %d %b %Y %H:%M:%S GMT')
    # CanonicalString: METHOD\nContent-MD5\nContent-Type\nDate\nCanonicalizedAmzHeaders\nCanonicalizedResource
    string_to_sign = f"{method}\n\n{content_type}\n{date}\nx-tos-acl:public-read\n/{bucket}/{quote(key)}"
    signature = base64.b64encode(
        hmac.new(secret_key.encode(), string_to_sign.encode(), hashlib.sha1).digest()
    ).decode()

    return url, {
        'Date': date,
        'x-tos-acl': 'public-read',
        'Authorization': f'TOS {access_key}:{signature}',
    }


def upload_with_curl(local_path, url, headers, max_retries=3):
    """用 curl 上传文件，支持重试"""
    curl_headers = []
    for k, v in headers.items():
        curl_headers.extend(['-H', f'{k}: {v}'])

    cmd = [
        'curl', '-sS', '-X', 'PUT',
        '--retry', str(max_retries),
        '--retry-delay', '5',
        '--retry-all-errors',
        '--connect-timeout', '30',
        '--max-time', '600',
        '-w', '\\n%{http_code}',
        '-T', local_path,
    ] + curl_headers + [url]

    for attempt in range(1, max_retries + 1):
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=650)
            output = result.stdout.strip()
            # 最后一行是 http_code
            lines = output.rsplit('\n', 1)
            if len(lines) == 2:
                body, code_str = lines
            else:
                body, code_str = '', lines[0]

            if code_str == '200':
                return True, f"HTTP 200"
            else:
                err = body[:200] if body else result.stderr[:200]
                if attempt < max_retries:
                    print(f"  ⚠️  尝试 {attempt}/{max_retries} 失败 (HTTP {code_str})，重试中...")
                    time.sleep(5 * attempt)
                else:
                    return False, f"HTTP {code_str}: {err}"
        except subprocess.TimeoutExpired:
            if attempt < max_retries:
                print(f"  ⚠️  尝试 {attempt}/{max_retries} 超时，重试中...")
                time.sleep(5 * attempt)
            else:
                return False, "上传超时"

    return False, "重试次数用完"


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

    # 确认 curl 可用
    subprocess.run(['curl', '--version'], capture_output=True, check=True)

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
        url, headers = sign_v2('PUT', bucket, remote_key, access_key, secret_key, region)

        size_mb = os.path.getsize(local_path) / 1024 / 1024
        print(f"\n→ 上传 {filename} ({size_mb:.1f} MB)...", flush=True)
        ok, msg = upload_with_curl(local_path, url, headers)
        if ok:
            print(f"  ✅ 成功")
            success += 1
        else:
            print(f"  ❌ 失败: {msg}")
            failed += 1

    print(f"\n=== 结果：{success} 成功，{failed} 失败 ===")
    sys.exit(1 if failed > 0 else 0)


if __name__ == '__main__':
    main()
