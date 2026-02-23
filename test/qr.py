import pyotp
secret = "5GCGWNN5NPT35VLPO64F77VXFIOUXEUG"
totp = pyotp.TOTP(secret)
uri = totp.provisioning_uri(name="Super Admin", issuer_name="AI Assessment Platform")
print(uri)  # Use this to generate QR code