This directory implements Google Drive wedding-process folder reconciliation
for issue #33. Public process responses omit Drive identifiers. Administrator
mutations require the signed, short-lived session cookie issued after
`MEMORIES_ADMIN_TOKEN` is verified by the dedicated login endpoint; the raw
password is not accepted by process endpoints.
