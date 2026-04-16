## What it does (2 sentences)

One one click gets the job applications from gmail api and organizes it into a tracker which updates on its own.

## Who uses it

People looking for job or internship who put 100s of application and have hard time tracking all

## Key user flows (numbered list)

- user logs in via google
- user clicks of get applications
- user gets the application in tabular form tracked which has manual edit feature and syncs itself and also has sync now feature

## Stack

- Next.js
- Supabase
- Typescript
- Postgresql
- prisma
- python if there is any data handling or ai calls
- open ai for the fallback if data is not recogized with pydantic

## Auth approach

- token based from gmail which can be stored and refreshed for sync or sync at login

## Deployment target

- vercel

## What it is NOT (constraints, out of scope)

- Not just a application tracker that would be excel but automated ai powered and suported tracker
