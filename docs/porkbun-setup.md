# Connect the Hybrid subdomains

The three subdomains use the existing `hybrid-management` Vercel project and Supabase database. You do not need to purchase another domain or change nameservers.

| Address | Purpose |
| --- | --- |
| https://management.hybridcombativegym.com/ | Staff sign-in and management |
| https://register.hybridcombativegym.com/ | New member registration for hybrid@KIP (DD) |
| https://checkin.hybridcombativegym.com/ | Existing member check-in for hybrid@KIP (DD) |

`checkin-hybridcombativegym.com` is a different domain. Use the address with a dot after `checkin`.

## Add the DNS records yourself

These screenshots come from [Porkbun's official guide](https://kb.porkbun.com/article/311-how-to-connect-a-domain-to-chatgpt-sites). They illustrate the buttons; use the Hybrid values below instead of the example values in the screenshots.

1. Sign in to Porkbun. Open **Account → Domain Management** and find `hybridcombativegym.com`.

   ![Porkbun Account menu with Domain Management](https://porkbun-media.s3.us-west-2.amazonaws.com/knowledgebase/account-domain-management.png)

2. Open **Details**, then the edit button beside **DNS Records**. If you already see the DNS editor, continue to step 3.

   ![Porkbun Details menu showing DNS Records](https://porkbun-media.s3.us-west-2.amazonaws.com/knowledgebase/details-menu-dnsrecords.png)

3. Select **Add Record**.

   ![Porkbun DNS editor showing the Add Record button](https://porkbun-media.s3.us-west-2.amazonaws.com/knowledgebase/dns-records-addbtn.png)

4. Choose **CNAME – Canonical name record**. Enter one row from this table, leave TTL at `600`, and save. Repeat for all three rows.

   | Type | Host | Answer / Value |
   | --- | --- | --- |
   | CNAME | `management` | `5bd35ddd6b2be31e.vercel-dns-017.com` |
   | CNAME | `register` | `5bd35ddd6b2be31e.vercel-dns-017.com` |
   | CNAME | `checkin` | `5bd35ddd6b2be31e.vercel-dns-017.com` |

   ![Porkbun DNS record form with Type, Host, and Answer fields](https://porkbun-media.s3.us-west-2.amazonaws.com/knowledgebase/dns-records-add.png)

   Enter only the subdomain label in **Host**, such as `register`. Enter the target without `https://` or a slash. These targets were returned by Vercel for this project during setup. If Vercel later recommends a different target, use its current value.

5. Keep unrelated DNS records, email records, and existing nameservers. If a record already exists for one of these exact hosts, inspect it before changing it; a CNAME cannot coexist with another record at the same host.

6. Open **Vercel → hybrid-management → Settings → Domains** and refresh each domain's status. Vercel must detect the records and provision HTTPS before the addresses work. Then open each address in a private browser window. Registration and check-in should open their public forms; management should require staff sign-in.

7. Download fresh registration and check-in QR codes from the management workspace after DNS and HTTPS work. Existing branch-specific URLs remain supported.

## Optional: connect Porkbun so the assistant can add DNS

The connector replaces the manual DNS steps. It does not require sharing a password or API key in chat. See [Porkbun's connection instructions](https://kb.porkbun.com/article/301-connect-porkbun-to-chatgpt) and [endpoint options](https://porkbun.com/mcp).

1. In Porkbun, enable **API Access** for `hybridcombativegym.com` if disabled.
2. In ChatGPT web, open **Settings → Security and login** and enable **Developer mode**, following Porkbun's guide. Workspace administrators may need to allow it first.
3. Open **Plugins → +**. Name the plugin `Porkbun` and select a public endpoint.
4. Enter `https://mcp.porkbun.com/mcp/no-purchases`. This endpoint includes DNS management and excludes purchases.
5. Create the plugin, sign in on Porkbun, and approve management access. Restrict the connected app to `hybridcombativegym.com` in Porkbun's API access settings.
6. Add the connected Porkbun plugin from the chat tools menu. If the current conversation cannot see it, open a new conversation and provide the repository and domain names from this guide.

If your ChatGPT interface uses different labels, follow the current official guide or use the manual DNS steps above. No passwords, secret API keys, or Supabase service keys are needed in the conversation.
