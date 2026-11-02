# Solar-panel image classifier

This service trains on the class folders in `../Faulty_solar_panel` and exposes the `POST /predict` endpoint used by the React app.

Use Python **3.11 or 3.12**. The installed Python 3.14 in this workspace is newer than the broadly supported PyTorch releases, so create a compatible virtual environment first. From this directory:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python train.py --epochs 12
uvicorn app:app --host 0.0.0.0 --port 8000
```

The training command saves the best checkpoint to `models/solar_panel_mobilenetv3.pth`, which is the checkpoint loaded by the API. It uses a stratified 80/20 validation split and weighted sampling to compensate for the smaller Electrical-damage and Snow-Covered folders.

The API allows both `http://localhost:5173` and `http://127.0.0.1:5173` for local development. Set `CORS_ORIGINS` to a comma-separated list of frontend origins when using a different address.

Then add this line to the root `.env` file and restart Vite:

```dotenv
VITE_MODEL_INFERENCE_URL=http://127.0.0.1:8000/predict
```

The response is compatible with the app’s existing model adapter:

```json
{"class":"Dusty","confidence":0.91,"is_fault":true}
```

`Clean` is treated as normal; every other supplied class is treated as a fault. Train/test accuracy is only a guide—the model may be less reliable on photos taken in lighting, angle, or panel types unlike the dataset.
