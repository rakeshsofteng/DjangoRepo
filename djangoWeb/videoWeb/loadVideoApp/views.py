from django.shortcuts import render
from django.http import HttpResponse, JsonResponse
from django.http import HttpRequest
from django.views.decorators.csrf import csrf_exempt
import os

#Create your views here.
def home(request):
    return HttpResponse("Hello world! here is video page.")

def contactus(request):
    return HttpResponse("THis is contact us page.")

def about(request):
    return HttpResponse("THis is about us page.")

# @csrf_exempt
# def upload_video(request):
#     if request.method == 'POST' and request.FILES.get('video'):
#         video_file = request.FILES['video']
#         save_path = os.path.join('media/videos', video_file.name)
#         with open(save_path, 'wb+') as f:
#             for chunk in video_file.chunks():
#                 f.write(chunk)
#         return JsonResponse({'url': f'/media/videos/{video_file.name}'})
#     return render(request, 'video_editor.html')

@csrf_exempt
def upload_video(request):
    if request.method == 'POST' and request.FILES.get('video'):
        video_file = request.FILES['video']
        allowed_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm']
        ext = os.path.splitext(video_file.name)[1].lower()

        if ext not in allowed_extensions:
            return JsonResponse({'error': 'Invalid file type. Please upload a video file.'}, status=400)

        save_path = os.path.join('media/videos', video_file.name)
        os.makedirs(os.path.dirname(save_path), exist_ok=True)

        with open(save_path, 'wb+') as f:
            for chunk in video_file.chunks():
                f.write(chunk)

        return JsonResponse({'url': f'/media/videos/{video_file.name}'})

    return render(request, 'video_editor.html')
