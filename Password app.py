password = input("Enter your password: ")

if len(password) >= 8:
    print("Long enough")
else:
    print("Too short")

has_number = False
for char in password:
    if char.isdigit():
        has_number = True
print(has_number)

has_special = False
special_characters = "!@#$%^&*"
for char in password:
    if char in special_characters:
        has_special = True
print(has_special)
