from django.urls import path
from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("api/save", views.save_project, name="save_project"),
    path("api/load", views.load_project, name="load_project"),
    path("api/export", views.export_video, name="export_video"),
    path("api/meta", views.video_meta, name="video_meta"),
]