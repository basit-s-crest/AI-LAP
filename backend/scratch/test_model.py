import torch
import sys
import numpy as np

# Patch torch.load to bypass weights_only=True and map cuda to cpu
orig_load = torch.load
def patched_load(*args, **kwargs):
    kwargs['weights_only'] = False
    kwargs['map_location'] = 'cpu'
    return orig_load(*args, **kwargs)
torch.load = patched_load

from hsemotion.facial_emotions import HSEmotionRecognizer

try:
    fer = HSEmotionRecognizer(model_name='enet_b2_8', device='cpu')
    dummy_face = np.zeros((260, 260, 3), dtype=np.uint8)
    emotion, scores = fer.predict_emotions(dummy_face, logits=False)
    print("Prediction Emotion:", emotion)
    print("Scores type:", type(scores))
    print("Scores content:", scores)
except Exception as e:
    print("Error:", e)
    sys.exit(1)
