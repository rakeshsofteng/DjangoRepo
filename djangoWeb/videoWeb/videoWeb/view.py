from django.shortcuts import render
from django.http import HttpResponse, JsonResponse


# Create your views here.
def home(request):
    return HttpResponse("Hello world! here is video page of main website")

def contactus(request):
    return HttpResponse("THis is contact us page of main website")

def about(request):
    return HttpResponse("THis is about us page of main website")

