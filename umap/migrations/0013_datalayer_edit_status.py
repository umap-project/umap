# Generated by Django 4.2.2 on 2023-09-19 06:20

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("umap", "0012_datalayer_settings"),
    ]

    operations = [
        migrations.AddField(
            model_name="datalayer",
            name="edit_status",
            field=models.SmallIntegerField(
                choices=[
                    (0, "Inherit"),
                    (1, "Everyone"),
                    (2, "Editors only"),
                    (3, "Owner only"),
                ],
                default=0,
                verbose_name="edit status",
            ),
        ),
    ]
