# Deploy Key Setup for iraniU-Business

## ⚠️ IMPORTANT: Add Deploy Key to GitHub First

### Your Deploy Key (Public)
Copy this entire key and add it to GitHub:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKsmwPe7O/A90JV3v0mzUG+DVB27oO5XrVgFHSrYz2c6 deploy@directory.iraniu.uk
```

### How to Add the Deploy Key

1. **Go to your repository:**
   https://github.com/Cynocotech/iraniU-Business/settings/keys

2. **Click "Add deploy key"**

3. **Fill in the details:**
   - **Title:** `directory.iraniu.uk Production Server`
   - **Key:** Paste the public key above
   - **Allow write access:** ☐ Leave unchecked (read-only is safer)

4. **Click "Add key"**

### After Adding the Key, Run This:

```bash
cd /root/directory-iraniu-uk
git clone git@github.com-directory:Cynocotech/iraniU-Business.git .
```

## PostgreSQL Database Ready

- **Database:** `directory_iraniu_uk`
- **User:** `directory_user`
- **Host:** `localhost`
- **Port:** `5432`

**Connection String:**
```
postgresql://directory_user:YOUR_PASSWORD@localhost:5432/directory_iraniu_uk
```

To set a new password for the database user:
```bash
sudo -u postgres psql -c "ALTER USER directory_user PASSWORD 'your_secure_password';"
```

## Project Location

- **Directory:** `/root/directory-iraniu-uk`
- **Domain:** `directory.iraniu.uk` (already pointed to this server)

## Test SSH Connection

After adding the deploy key, test it:
```bash
ssh -T git@github.com-directory
```

You should see: `Hi Cynocotech/iraniU-Business! You've successfully authenticated...`
