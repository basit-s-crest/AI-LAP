import numpy as np
import traceback
import torch

# Monkeypatch torch.load to bypass weights_only=True default and handle CPU mapping in PyTorch 2.6+
orig_load = torch.load
def patched_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    if not torch.cuda.is_available():
        kwargs['map_location'] = 'cpu'
    return orig_load(*args, **kwargs)
torch.load = patched_load

try:
    print("Loading model...")
    from hsemotion.facial_emotions import HSEmotionRecognizer
    fer_model = HSEmotionRecognizer(model_name='enet_b2_8', device='cpu')
    print("Running inference on dummy image...")
    img_np = np.zeros((224, 224, 3), dtype=np.uint8)
    emotion, scores = fer_model.predict_emotions(img_np, logits=False)
    print("Success! emotion:", emotion)
except Exception as e:
    print("Caught unexpected exception:")
    traceback.print_exc()

