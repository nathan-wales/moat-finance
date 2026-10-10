# Data Retention and Deletion Policy

**Effective Date:** April 2026  
**Last Updated:** April 18, 2026

## Overview

This document outlines how Moat Finance handles user data retention, deletion, and privacy compliance. We are committed to protecting user privacy and providing transparency about how data is managed throughout its lifecycle.

## Data Categories

### Active User Data
- **Transaction history**: All imported and manually entered transactions
- **Financial accounts**: Connected Plaid institutions, account balances
- **Rules and automations**: User-created transaction categorization rules
- **Categories and hashtags**: Custom organizational structures
- **Investments and real estate**: Portfolio tracking data
- **Forecast scenarios**: Financial planning models
- **User preferences**: Application settings and configurations

### Account Authentication Data
- **Session tokens**: Active login sessions
- **OAuth connections**: Google, Apple sign-in links
- **Two-factor authentication**: TOTP secrets and backup codes

## Retention Periods

| Data Type | Retention Period | Notes |
|-----------|-----------------|-------|
| Active account data | Indefinite while account is active | User has full control |
| Deleted account data | Immediate | No recovery window |
| System backups | 90 days | Standard backup rotation |
| Audit logs | 1 year | Security and compliance |
| Anonymized analytics | Indefinite | Non-identifiable data |

## Account Deletion Process

### User-Initiated Deletion

1. **Request**: User clicks "Delete Account" in Settings > Security
2. **Verification**: User confirms with password and acknowledgment checkbox
3. **Immediate Deletion**: Account is permanently deleted
   - All active sessions are invalidated
   - All Plaid access tokens are revoked
   - All user data is permanently removed
   - User is signed out

### What Gets Deleted

When an account is deleted, the following data is immediately and permanently removed:

- User profile (name, email, image)
- All transactions (CSV imports, Plaid transactions, manual entries)
- Connected bank accounts and Plaid integrations
- Investment and real estate portfolio data
- Forecast scenarios and projections
- Transaction rules and automations
- Custom categories and hashtags
- CSV column mappings
- Authentication sessions and tokens
- Two-factor authentication configuration
- User settings and preferences

### Third-Party Service Cleanup

Upon deletion, we:

1. **Plaid**: Revoke all access tokens to disconnect bank accounts
2. **OAuth Providers**: Unlink Google/Apple connections
3. **Analytics**: Remove or anonymize user profiles

## Data Export (Data Portability)

Users can export their data at any time via Settings > Security > Export My Data:

- **Format**: JSON (machine-readable) or CSV (human-readable)
- **Contents**: All personal data including transactions, accounts, rules, categories
- **Delivery**: Immediate download

This supports GDPR Article 20 (Right to Data Portability) and CCPA requirements.

## Legal Holds

Data may be retained beyond standard periods when:

- Required by law enforcement or legal process
- Subject to active litigation
- Required for regulatory compliance

Users will be notified of legal holds when legally permitted.

## Privacy Rights

### Right to Access
Users can view all their data within the application at any time.

### Right to Rectification
Users can edit their data (transactions, categories, etc.) directly in the application.

### Right to Erasure (Right to be Forgotten)
Users can delete their account and all associated data via the deletion flow described above.

### Right to Restrict Processing
Contact support to request processing restrictions while maintaining data.

### Right to Data Portability
Use the data export feature to receive your data in a portable format.

### Right to Object
Contact support to object to specific data processing activities.

## Security Measures

- All data is encrypted at rest and in transit
- Access tokens for bank connections are encrypted with AES-256
- Password hashes use bcrypt with appropriate cost factors
- Regular security audits and penetration testing

## Contact

For questions about this policy or to exercise your privacy rights:

- **Email**: support@moatfinance.ai
- **In-App**: Settings > Security > Contact Support

## Policy Updates

We will notify users of material changes to this policy via:
- Email notification
- In-app announcement
- Updated "Last Updated" date above

## Compliance

This policy is designed to comply with:
- **GDPR** (General Data Protection Regulation)
- **CCPA** (California Consumer Privacy Act)
- **Other applicable privacy regulations**
