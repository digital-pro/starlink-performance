import pyautogui
import pytesseract
import time
from datetime import datetime
from PIL import Image

# Wait for user to open Event Log
input('Open BlueStacks and the Starlink Event Log. Press Enter to continue...')

# Set the region (update these for your environment)
LEFT, TOP, WIDTH, HEIGHT = 100, 200, 600, 300  # Example values
im = pyautogui.screenshot(region=(LEFT, TOP, WIDTH, HEIGHT))
im.save('eventlog_gui.png')

# OCR extract
text = pytesseract.image_to_string(Image.open('eventlog_gui.png'))
save_path = r'\\wsl$\\Ubuntu\\home\\YOUR_USER\\levante\\starlink-performance\\data\\events_log_gui.txt'
with open(save_path, 'a') as f:
    f.write(f"{datetime.now().isoformat()} | {text}\n")

print('GUI Event Log extraction complete!')
