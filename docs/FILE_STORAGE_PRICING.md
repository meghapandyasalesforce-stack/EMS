# EMS — AWS S3 File Storage Pricing Reference

**Last updated:** July 2025
**Storage provider:** Amazon S3 (ap-south-1 — Mumbai)
**Applies to:** Profile photos, employee documents, offer letter PDFs, resume attachments

---

## What is stored on S3

| File type | S3 key prefix | Access | Avg file size |
|---|---|---|---|
| Profile photo (full) | `{orgId}/profile-photos/{empId}-{ts}.jpg` | Public URL | ~150 KB |
| Profile photo (thumbnail) | `{orgId}/profile-photos/{empId}-{ts}_thumb.jpg` | Public URL | ~20 KB |
| Employee documents (Aadhar, PAN, etc.) | `{orgId}/documents/{filename}` | Private — signed URL | ~500 KB |
| HR-uploaded company documents | `{orgId}/documents/{filename}` | Private — signed URL | ~500 KB |
| Offer letter PDF templates | `{orgId}/pdf-templates/{filename}` | Private — signed URL | ~1 MB |
| Generated offer letter PDFs | `{orgId}/pdf-templates/generated/{filename}` | Private — signed URL | ~500 KB |
| Resume attachments (inbox) | `{orgId}/resumes/{filename}` | Private — signed URL | ~300 KB |

---

## When S3 is actually called

**Opening any list/dashboard page = 0 S3 requests.**
All list views (documents tab, employee list, HR dashboard) only query MongoDB for metadata. S3 is only hit on these explicit user actions:

| User action | S3 operation | Count |
|---|---|---|
| Upload profile photo | PUT × 2 (photo + thumbnail) | 2 PUTs |
| Replace profile photo | DELETE × 2 + PUT × 2 | 2 DELETEs + 2 PUTs |
| Delete profile photo | DELETE × 2 | 2 DELETEs |
| Upload any document | PUT × 1 | 1 PUT |
| Replace document version | DELETE × 1 + PUT × 1 | 1 DELETE + 1 PUT |
| Preview or download a document | GET × 1 (signed URL, browser fetches from S3) | 1 GET |
| Upload offer letter PDF template | PUT × 1 | 1 PUT |
| Generate/preview offer letter | PUT × 1 (generated PDF) | 1 PUT |
| Resume received via email inbox | PUT × 1 | 1 PUT |

---

## AWS S3 Pricing — ap-south-1 (Mumbai)

> Source: https://aws.amazon.com/s3/pricing/
> Prices are in USD. Verify current rates before billing decisions.

### Storage
| Tier | Price |
|---|---|
| First 50 TB / month | $0.025 per GB |
| Next 450 TB / month | $0.024 per GB |

### Requests
| Request type | Price |
|---|---|
| PUT, COPY, POST, LIST | $0.0054 per 1,000 requests |
| GET, SELECT, and all others | $0.00043 per 1,000 requests |
| DELETE | Free |

### Data transfer (egress out of S3 to internet)
| Tier | Price |
|---|---|
| First 100 GB / month | Free |
| Next 9.9 TB / month | $0.109 per GB |

> Profile photos served as public URLs count as egress. Signed URL downloads also count as egress once the browser fetches from S3.

---

## AWS Free Tier (first 12 months only)

| Resource | Free allowance |
|---|---|
| Storage | 5 GB |
| GET requests | 20,000 per month |
| PUT requests | 2,000 per month |
| Data transfer out | 100 GB per month |

---

## Monthly cost estimate by org size

Assumptions per scenario:
- Each employee has 1 profile photo (full + thumb = ~170 KB)
- Each employee uploads ~5 documents on joining (~500 KB each)
- HR downloads/previews ~50 documents/month
- HR uploads ~10 company documents/month
- ~10 offer letters generated/month
- ~20 resumes received via email inbox/month

### Small org — 50 employees

| Resource | Usage | Cost |
|---|---|---|
| Storage | ~0.5 GB (photos ~8 MB + docs ~125 MB + misc) | **$0.013/month** |
| PUT requests | ~150/month | **$0.001/month** |
| GET requests | ~80/month | **< $0.001/month** |
| Egress (profile photos loaded in browser) | ~500 MB/month | **Free (within 100 GB)** |
| **Total** | | **~$0.02/month** |

✅ Well within free tier for first 12 months. After free tier: essentially free.

---

### Medium org — 200 employees

| Resource | Usage | Cost |
|---|---|---|
| Storage | ~2 GB | **$0.05/month** |
| PUT requests | ~400/month | **$0.002/month** |
| GET requests | ~300/month | **$0.001/month** |
| Egress | ~2 GB/month | **Free (within 100 GB)** |
| **Total** | | **~$0.05/month** |

✅ Still within free tier storage for first 12 months. After free tier: under $0.10/month.

---

### Large org — 1,000 employees

| Resource | Usage | Cost |
|---|---|---|
| Storage | ~10 GB | **$0.25/month** |
| PUT requests | ~1,500/month | **$0.008/month** |
| GET requests | ~1,500/month | **$0.001/month** |
| Egress | ~10 GB/month | **Free (within 100 GB)** |
| **Total** | | **~$0.26/month** |

✅ Exceeds free tier storage after month 1 (5 GB limit). After free tier: under $0.30/month.

---

### Heavy usage — 1,000 employees, active HR team

Assumes HR previews/downloads 500 docs/month, 100 offer letters generated, 200 resumes/month.

| Resource | Usage | Cost |
|---|---|---|
| Storage | ~15 GB | **$0.375/month** |
| PUT requests | ~5,000/month | **$0.027/month** |
| GET requests | ~800/month | **$0.001/month** |
| Egress | ~20 GB/month | **Free (within 100 GB)** |
| **Total** | | **~$0.40/month** |

---

## When would costs get significant?

Costs only become meaningful if:

1. **Thousands of document downloads per day** — e.g. employees downloading payslips, bulk HR exports. At 1 TB egress/month that's ~$109.
2. **Very large files** — video training materials, large CAD files etc. Not applicable to this HRMS.
3. **Accidental public bucket** — if profile photos are served publicly at high traffic (e.g. embedded in a public-facing app). At current scale this is still free.

For a standard HRMS with 50–1,000 employees doing normal HR operations, **total S3 cost will be $0–$1/month**.

---

## Cost optimization already in place

| Optimization | How it's implemented |
|---|---|
| Thumbnails for profile photos | `imageOptimizer.js` generates a 200px thumbnail — list views load the small thumbnail, not the full image |
| Private documents never served publicly | All sensitive docs use signed URLs (15 min expiry) — no public CDN bandwidth |
| No fileBinary in MongoDB | Removed from `document.model.js` — saves MongoDB storage and read costs |
| Generated offer PDFs stored as S3 keys | Not duplicated in MongoDB |
| Memory-only upload | `multer.memoryStorage()` — files never written to disk, go straight to S3 |

---

## Recommended S3 lifecycle rule (optional)

Add this in the AWS console to auto-delete temporary generated offer letter previews after 7 days:

- **Prefix:** `{orgId}/pdf-templates/generated/`
- **Action:** Expire objects after **7 days**
- **Saves:** ~10 MB/month of stale preview PDFs

---

## Environment variables required

```
AWS_ACCESS_KEY_ID=<your_key>
AWS_SECRET_ACCESS_KEY=<your_secret>
AWS_REGION=ap-south-1
AWS_S3_BUCKET=<your-bucket-name>
```

Set these in `server/.env` (local) and in your hosting provider's environment config (Render/Railway/EC2 for production).

---

## Pricing sources

- S3 pricing: https://aws.amazon.com/s3/pricing/
- S3 free tier: https://aws.amazon.com/free/
- AWS data transfer pricing: https://aws.amazon.com/ec2/pricing/on-demand/#Data_Transfer

> Always verify current pricing directly on AWS before making billing decisions. Prices vary by region and change over time.
