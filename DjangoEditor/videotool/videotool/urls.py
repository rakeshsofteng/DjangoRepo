"""
URL configuration for videotool project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include

from django.conf import settings
from django.conf.urls.static import static

#from editor import views

urlpatterns = [
    path("", include("editor.urls")),
    path('admin/', admin.site.urls),
    # path("api/save", views.save_project, name="save_project"),
    # path("api/load", views.load_project, name="load_project"),
    # path("api/export", views.export_video, name="export_video"),
    # path("api/meta", views.video_meta, name="video_meta"),
   
]+ static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
