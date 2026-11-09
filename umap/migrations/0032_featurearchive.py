import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("umap", "0031_expiredfeature")]

    operations = [
        migrations.CreateModel(
            name="FeatureArchive",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        primary_key=True,
                        default=uuid.uuid4,
                        editable=False,
                        serialize=False,
                    ),
                ),
                ("feature_id", models.CharField(max_length=255)),
                ("source_hash", models.CharField(max_length=64)),
                ("payload", models.JSONField(default=dict)),
                ("completed", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "source",
                    models.ForeignKey(
                        to="umap.datalayer",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="outgoing_archives",
                    ),
                ),
                (
                    "target",
                    models.ForeignKey(
                        to="umap.datalayer",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="incoming_archives",
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("source", "feature_id"), name="unique_feature_archive"
                    ),
                    models.UniqueConstraint(
                        fields=("target", "feature_id"), name="unique_archive_target"
                    ),
                ]
            },
        ),
    ]
