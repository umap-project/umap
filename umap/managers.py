from django.db import models


class PublicManager(models.Manager):
    def get_queryset(self):
        return (
            super(PublicManager, self)
            .get_queryset()
            .filter(share_status=self.model.PUBLIC)
        )

    def starred_by_staff(self):
        from .models import Star, User

        staff = User.objects.filter(is_staff=True)
        stars = Star.objects.filter(by__in=staff).values("map")
        return self.get_queryset().filter(pk__in=stars)


class PrivateQuerySet(models.QuerySet):
    def for_user(self, user):
        qs = self.exclude(share_status__in=[self.model.DELETED, self.model.BLOCKED])
        teams = user.teams.all()
        qs = (
            qs.filter(owner=user)
            .union(qs.filter(editors=user))
            .union(qs.filter(team__in=teams))
        )
        return qs


class PrivateManager(models.Manager):
    def get_queryset(self):
        return PrivateQuerySet(self.model, using=self._db)

    def for_user(self, user):
        return self.get_queryset().for_user(user)
