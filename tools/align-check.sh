#!/bin/sh
# Measure the layout lines at three widths. Usage: sh tools/align-check.sh [URL]
URL=${1:-http://127.0.0.1:8835/}
for size in 1440,900 1024,768 800,1000; do
  "C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --use-angle=d3d11 --window-size=$size --virtual-time-budget=9000 --dump-dom "$URL?check=1&hour=12" 2>/dev/null | grep -o '<title>[^<]*</title>' | sed "s/^/$size  /"
done
