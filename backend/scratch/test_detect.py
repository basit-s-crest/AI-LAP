import requests
import io
import base64
from PIL import Image

# Generate a valid small solid color JPEG image in memory
img = Image.new("RGB", (100, 100), color="blue")
buffer = io.BytesIO()
img.save(buffer, format="JPEG")
img_bytes = buffer.getvalue()
img_base64 = base64.b64encode(img_bytes).decode("utf-8")
payload_frame = f"data:image/jpeg;base64,{img_base64}"

url = "http://localhost:8001/api/emotion/detect"
payload = {
    "frame": payload_frame
}
headers = {
    "Content-Type": "application/json"
}

try:
    print(f"Sending POST request with valid JPEG to {url}...")
    response = requests.post(url, json=payload, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Error calling endpoint: {e}")
