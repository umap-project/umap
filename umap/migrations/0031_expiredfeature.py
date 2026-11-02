import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("umap", "0030_tilelayer_is_vector")]

    operations = [
        migrations.CreateModel(
            name="ExpiredFeature",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("feature_id", models.CharField(max_length=255)),
                (
                    "datalayer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, to="umap.datalayer"
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("datalayer", "feature_id"),
                        name="unique_expired_feature",
                    )
                ]
            },
        ),
    ]
