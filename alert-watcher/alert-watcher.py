import os
import time
import httpx
from opensearchpy import OpenSearch

BOT_TOKEN = os.environ["BOT_TOKEN"]
CHAT_ID = os.environ["CHAT_ID"]
OS_HOST = os.environ.get("OS_HOST", "http://opensearch:9200")
JAEGER_UI = os.environ.get("JAEGER_UI", "http://localhost:16686")
SLOW_MS = int(os.environ.get("SLOW_MS", "1000"))
INTERVAL = int(os.environ.get("CHECK_INTERVAL", "60"))

client = OpenSearch(hosts=[OS_HOST], use_ssl=False, verify_certs=False)
seen = set()


def send_telegram(message: str):
    r = httpx.post(
        f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
        json={"chat_id": CHAT_ID, "text": message, "parse_mode": "Markdown"},
        timeout=15,
    )
    if r.status_code != 200:
        print(f"Telegram xato: {r.status_code} {r.text}")


def check_traces():
    slow_us = SLOW_MS * 1000
    since_us = int((time.time() - INTERVAL) * 1_000_000)

    query = {
        "size": 20,
        "query": {
            "bool": {
                "filter": [
                    {"range": {"startTime": {"gte": since_us}}}
                ],
                "should": [
                    {"range": {"duration": {"gte": slow_us}}},
                    {"term": {"tag.error": True}},
                    {"term": {"tag.error": "true"}},
                    {"range": {"tag.http.status_code": {"gte": 500}}},
                ],
                "minimum_should_match": 1,
            }
        },
    }

    result = client.search(index="jaeger-jaeger-span-*", body=query)
    total = result.get("hits", {}).get("total", 0)
    if isinstance(total, dict):
        total = total.get("value", 0)
    print(f"OpenSearch: {total} span topildi")

    for hit in result.get("hits", {}).get("hits", []):
        src = hit["_source"]
        trace_id = src.get("traceID") or src.get("traceId")
        if not trace_id or trace_id in seen:
            continue
        seen.add(trace_id)

        duration_ms = src.get("duration", 0) / 1000
        service = (
            src.get("process", {}).get("serviceName")
            or src.get("serviceName")
            or "unknown"
        )
        operation = src.get("operationName", "unknown")
        tag_map = src.get("tag", {}) or {}
        status_code = tag_map.get("http.status_code")
        is_error = (
            tag_map.get("error") in (True, "true", "True")
            or (status_code is not None and int(status_code) >= 500)
        )

        if is_error:
            emoji, reason = "🔴", "ERROR"
        else:
            emoji, reason = "🟡", f"SEKIN: {duration_ms:.0f}ms"

        msg = (
            f"{emoji} *{reason}*\n"
            f"Service: `{service}`\n"
            f"Operation: `{operation}`\n"
            f"Duration: `{duration_ms:.0f}ms`\n"
            f"[Jaeger]({JAEGER_UI}/trace/{trace_id})"
        )
        send_telegram(msg)
        print(f"Sent: {service} {operation}")


print("alert-watcher ishga tushdi")
send_telegram("✅ alert-watcher ishga tushdi")

while True:
    try:
        check_traces()
    except Exception as e:
        print(f"Xato: {e}")
    time.sleep(INTERVAL)
