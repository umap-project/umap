test:
	py.test
develop:
	python setup.py develop
compilemessages:
	django-admin.py compilemessages
makemessages:
	django-admin.py makemessages -a
