from django.shortcuts import render

# Create your views here.
import json, os
from django.conf import settings
from django.http import JsonResponse, HttpResponseBadRequest
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from .forms import UploadForm
from .ffmpeg_utils import export_with_ffmpeg
import cv2

PROJECT_FILE = os.path.join(settings.MEDIA_ROOT, "project.json")

def index(request):
    ctx = {}
    if request.method == "POST":
        form = UploadForm(request.POST, request.FILES)
        if form.is_valid():
            f = form.cleaned_data["video"]
            os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
            save_path = os.path.join(settings.MEDIA_ROOT, f.name)
            with open(save_path, "wb") as dst:
                for chunk in f.chunks():
                    dst.write(chunk)
            ctx["video_url"] = settings.MEDIA_URL + f.name
            ctx["video_name"] = f.name
        else:
            ctx["error"] = "Invalid upload"
    return render(request, "editor/index.html", ctx)

def _video_meta(abs_path):
    cap = cv2.VideoCapture(abs_path)
    if not cap.isOpened():
        return None
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
    cap.release()
    return total_frames, fps

def video_meta(request):
    path = request.GET.get("name")
    if not path:
        return HttpResponseBadRequest("Missing name")
    abs_path = os.path.join(settings.MEDIA_ROOT, path)
    if not os.path.exists(abs_path):
        return HttpResponseBadRequest("Not found")
    meta = _video_meta(abs_path)
    if not meta:
        return HttpResponseBadRequest("Unreadable")
    total_frames, fps = meta
    return JsonResponse({"ok": True, "total_frames": total_frames, "fps": fps})

@csrf_exempt
def save_project(request):
    if request.method != "POST":
        return HttpResponseBadRequest("POST only")
    data = json.loads(request.body.decode("utf-8"))
    os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
    with open(PROJECT_FILE, "w") as f:
        json.dump(data, f)
    return JsonResponse({"ok": True})

def load_project(request):
    if not os.path.exists(PROJECT_FILE):
        return JsonResponse({"ok": True, "deletes": [], "video_name": None})
    with open(PROJECT_FILE, "r") as f:
        data = json.load(f)
    return JsonResponse({"ok": True, **data})

@csrf_exempt
def export_video(request):
    if request.method != "POST":
        return HttpResponseBadRequest("POST only")
    payload = json.loads(request.body.decode("utf-8"))
    deletes = payload.get("deletes", [])
    video_name = payload.get("video_name")
    if not video_name:
        return HttpResponseBadRequest("Missing video_name")
    in_path = os.path.join(settings.MEDIA_ROOT, video_name)
    if not os.path.exists(in_path):
        return HttpResponseBadRequest("Video not found")
    meta = _video_meta(in_path)
    if not meta:
        return HttpResponseBadRequest("Could not read video")
    total_frames, fps = meta
    out_name = f"edited_{os.path.splitext(video_name)[0]}.mp4"
    out_path = os.path.join(settings.MEDIA_ROOT, out_name)
    try:
        export_with_ffmpeg(in_path, out_path, deletes, fps, total_frames)
    except Exception as e:
        return HttpResponseBadRequest(f"Export failed: {e}")
    return JsonResponse({"ok": True, "download_url": settings.MEDIA_URL + out_name})
