import re

with open('api_server.py', 'r', encoding='utf-8') as f:
    content = f.read()

replacements = {
    'require_permission("admin.dashboard")': 'require_permission("admin.dashboard.view")',
    'require_permission("users.view")': 'require_permission("admin.users.manage")',
    'require_permission("users.manage")': 'require_permission("admin.users.manage")',
    'require_permission("users.suspend")': 'require_permission("admin.users.manage")',
    'require_permission("meetings.manage")': 'require_permission("clubs.meetings.manage")',
    'require_permission("meetings.delete")': 'require_permission("clubs.meetings.manage")',
    'require_permission("clubs.view")': 'require_permission("admin.clubs.manage_global")',
    'require_permission("clubs.manage")': 'require_permission("admin.clubs.manage_global")',
    'require_permission("admin.permissions.manage")': 'require_permission("admin.settings.manage")'
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open('api_server.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Permissions updated.")
