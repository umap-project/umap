from django.core.management.base import BaseCommand

from umap.models import Map, User


class Command(BaseCommand):
    help = "Replace a user by another as owner or editor or team member. Eg. umap switch_user oldUserName newUserName"

    def add_arguments(self, parser):
        parser.add_argument("old", help="Old username.")
        parser.add_argument("new", help="New username.")
        parser.add_argument(
            "--dry-run",
            help="Do not replace for real, just display actions",
            action="store_true",
        )
        parser.add_argument(
            "--delete-user",
            help="Also delete old user",
            action="store_true",
        )

    def handle(self, *args, **options):
        old = User.objects.get(username=options["old"])
        new = User.objects.get(username=options["new"])
        print(f"Replacing usre {old} by user {new}")
        owned_maps = old.owned_maps.all()
        print(f"Replacing owner of {len(owned_maps)} maps")
        if not options["dry_run"]:
            for mm in owned_maps:
                mm.owner = new
                mm.save()

        as_editor = Map.objects.filter(editors=old)
        print(f"Replacing editor of {len(as_editor)} maps")
        if not options["dry_run"]:
            for mm in as_editor:
                mm.editors.remove(old)
                mm.editors.add(new)
                mm.save()

        teams = old.teams.all()
        print(f"Replacing editor of {len(teams)} maps")
        if not options["dry_run"]:
            for team in teams:
                team.users.remove(old)
                team.users.add(new)
                team.save()

        if not options["dry_run"] and options["delete_user"]:
            old.delete()
            print("Deleted old user.")
