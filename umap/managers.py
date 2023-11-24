from django.db.models import Manager


class PublicManager(Manager):
    def get_queryset(self):
        return (
            super(PublicManager, self)
            .get_queryset()
            .filter(share_status=self.model.PUBLIC)
        )
