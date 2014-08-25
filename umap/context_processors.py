from django.conf import settings

def feedback_link(request):
    return {
        'UMAP_FEEDBACK_LINK': settings.UMAP_FEEDBACK_LINK
    }
