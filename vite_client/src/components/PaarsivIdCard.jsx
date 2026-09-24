import React from 'react';
import { useSignedProfilePhoto } from '../Hooks/useSignedProfilePhoto';
import { getProfilePhotoUrl } from '../utils/axios';

function getEmbeddedPhotoUrl(profilePhoto) {
  if (!profilePhoto) return null;
  if (typeof profilePhoto === 'string') {
    if (profilePhoto.startsWith('/uploads/')) return getProfilePhotoUrl(profilePhoto);
    if (/[?&]X-Amz-Signature=/i.test(profilePhoto)) return profilePhoto;
    return null;
  }
  if (typeof profilePhoto.signedUrl === 'string' && profilePhoto.signedUrl) {
    return profilePhoto.signedUrl.startsWith('/uploads/')
      ? getProfilePhotoUrl(profilePhoto.signedUrl)
      : profilePhoto.signedUrl;
  }
  if (typeof profilePhoto.url === 'string') {
    if (/[?&]X-Amz-Signature=/i.test(profilePhoto.url)) return profilePhoto.url;
    if (profilePhoto.url.startsWith('/uploads/')) return getProfilePhotoUrl(profilePhoto);
  }
  return null;
}

/**
 * Colors locked to the Clara Jenkins / Paarsiv ID card reference.
 */
export const PAARSIV_ID = {
  green: '#2BAA75',
  charcoal: '#1A1A1A',
  title: '#1A1A1A',
  border: '#E2E2E2',
  photoRing: '#C4C4C4',
  photoFill: '#E8E8E8',
  cardBg: '#F5FAF7',
  white: '#FFFFFF',
  footerBg: '#D3D3D3',
  footerText: '#1A1A1A',
  pattern: '#A8D4BC',
  website: 'www.paarsiv.com',
};

const sizePresets = {
  full: { width: 280 },
  preview: { width: 240 },
  mini: { width: 180 },
};

const TYPEFACE =
  'Montserrat, Poppins, "Helvetica Neue", Helvetica, Arial, sans-serif';

/**
 * Exact corner wireframe from the Paarsiv reference (extracted PNG).
 * mix-blend-mode:multiply hides the white background so only mint lines remain.
 */
const CornerMesh = ({ corner }) => {
  const isTR = corner === 'top-right';
  return (
    <img
      src="/paarsiv-corner-pattern.png"
      alt=""
      aria-hidden
      className="pointer-events-none absolute select-none"
      style={
        isTR
          ? {
              top: 0,
              right: 0,
              width: '62%',
              height: 'auto',
              opacity: 0.85,
              mixBlendMode: 'multiply',
            }
          : {
              bottom: '9%',
              left: 0,
              width: '58%',
              height: 'auto',
              opacity: 0.75,
              mixBlendMode: 'multiply',
              transform: 'rotate(180deg)',
            }
      }
      draggable={false}
    />
  );
};

/** Wordmark: p + s green; aar + iv charcoal (exact brand treatment) */
const PaarsivLogo = ({ fontSize }) => (
  <p
    className="select-none lowercase"
    style={{
      fontSize,
      fontWeight: 700,
      letterSpacing: '-0.03em',
      lineHeight: 1,
      fontFamily: TYPEFACE,
    }}
  >
    <span style={{ color: PAARSIV_ID.green }}>p</span>
    <span style={{ color: PAARSIV_ID.charcoal }}>aar</span>
    <span style={{ color: PAARSIV_ID.green }}>s</span>
    <span style={{ color: PAARSIV_ID.charcoal }}>iv</span>
  </p>
);

/** Soft-split CamelCase / PascalCase so "TestingIntern" → "Testing Intern" */
const formatDisplayName = (name = '', lastName = '') => {
  const splitCamel = (s) =>
    String(s || '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      // All-caps compounds like TESTINGINTERN → TESTING INTERN when a known suffix is present
      .replace(
        /(INTERN|EMPLOYEE|MANAGER|ANALYST|ENGINEER|DEVELOPER|DESIGNER|ADMIN|OFFICER|EXECUTIVE)$/i,
        ' $1'
      )
      .replace(/\s+/g, ' ')
      .trim();

  const first = splitCamel(name);
  const last = splitCamel(lastName);
  const combined = [first, last].filter(Boolean).join(' ').trim();
  return combined || 'Employee';
};

/**
 * Front ID card matching the Paarsiv reference mockup layout.
 * Live employee props only change content — structure stays fixed.
 */
const PaarsivIdCard = ({
  name = '',
  lastName = '',
  jobTitle = 'Employee',
  employeeId = '',
  cardNumber = '',
  photoUrl,
  profilePhoto,
  userId,
  size = 'full',
  showHole = false,
  className = '',
  website = PAARSIV_ID.website,
}) => {
  const width = (sizePresets[size] || sizePresets.full).width;
  const k = width / 280;

  const logoSize = 26 * k;
  const photo = 124 * k;
  const ringOuter = 1.75 * k;
  const ringGap = 3.25 * k;
  const nameSize = 14 * k;
  const titleSize = 9 * k;
  const idSize = 11.5 * k;
  const footerH = 30 * k;
  const accentH = 2.75 * k;
  const padX = 18 * k;

  // Shift stack down; even gaps so bottom doesn’t look empty
  const topPad = 28 * k;
  const gapLogoToPhoto = 16 * k;
  const gapPhotoToName = 14 * k;
  const gapNameToTitle = 8 * k;
  const gapTitleToId = 14 * k;

  const displayName = formatDisplayName(name, lastName);
  const displayId = employeeId || cardNumber || '—';
  const frameSize = photo + (ringOuter + ringGap) * 2;

  // Prefer URL already signed by the ID-card API; otherwise resolve via hook
  const embeddedPhotoUrl = getEmbeddedPhotoUrl(profilePhoto);
  const { photoUrl: signedPhotoUrl } = useSignedProfilePhoto(profilePhoto, {
    userType: 'employee',
    userId,
    preferFull: true,
  });
  const displayPhotoUrl = photoUrl || embeddedPhotoUrl || signedPhotoUrl;

  return (
    <div
      className={`relative mx-auto overflow-hidden ${className}`}
      style={{
        width,
        maxWidth: '100%',
        aspectRatio: '2 / 3',
        borderRadius: 24 * k,
        backgroundColor: PAARSIV_ID.cardBg,
        border: `1px solid ${PAARSIV_ID.border}`,
        boxShadow: '0 18px 44px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.05)',
      }}
    >
      <CornerMesh corner="top-right" />
      <CornerMesh corner="bottom-left" />

      {showHole ? (
        <div
          className="absolute left-1/2 z-10 -translate-x-1/2 rounded-full"
          style={{
            top: 10 * k,
            width: 10 * k,
            height: 10 * k,
            background: '#2C2F2E',
          }}
          aria-hidden
        />
      ) : null}

      <div className="relative z-[1] flex h-full flex-col">
        {/* Logo + photo + text — shifted down and vertically balanced */}
        <div
          className="flex min-h-0 flex-1 flex-col items-center"
          style={{
            paddingTop: topPad,
            paddingBottom: 12 * k,
            justifyContent: 'center',
          }}
        >
          <div className="flex w-full shrink-0 justify-center" style={{ marginBottom: gapLogoToPhoto }}>
            <PaarsivLogo fontSize={logoSize} />
          </div>

          <div
            className="relative shrink-0 rounded-full"
            style={{
              width: frameSize,
              height: frameSize,
              marginBottom: gapPhotoToName,
              boxSizing: 'border-box',
              border: `${ringOuter}px solid ${PAARSIV_ID.photoRing}`,
              padding: ringGap,
              backgroundColor: PAARSIV_ID.white,
            }}
          >
            <div
              className="relative h-full w-full overflow-hidden rounded-full"
              style={{ backgroundColor: PAARSIV_ID.photoFill }}
            >
              {displayPhotoUrl ? (
                <img
                  src={displayPhotoUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover object-center"
                />
              ) : null}
            </div>
          </div>

          <div
            className="flex w-full flex-col items-center text-center"
            style={{ paddingLeft: padX, paddingRight: padX }}
          >
            <h3
              className="max-w-full font-bold uppercase"
              style={{
                color: PAARSIV_ID.charcoal,
                fontSize: nameSize,
                letterSpacing: '0.06em',
                lineHeight: 1.25,
                fontFamily: TYPEFACE,
                marginBottom: gapNameToTitle,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
              }}
              title={displayName}
            >
              {displayName}
            </h3>

            <p
              className="max-w-full uppercase"
              style={{
                color: PAARSIV_ID.title,
                fontSize: titleSize,
                fontWeight: 400,
                letterSpacing: '0.16em',
                lineHeight: 1.35,
                marginBottom: gapTitleToId,
                fontFamily: TYPEFACE,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
              }}
              title={jobTitle}
            >
              {jobTitle}
            </p>

            <p
              className="max-w-full font-bold uppercase"
              style={{
                color: PAARSIV_ID.charcoal,
                fontSize: idSize,
                letterSpacing: '0.04em',
                lineHeight: 1.25,
                fontFamily: TYPEFACE,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
              }}
              title={displayId}
            >
              {displayId}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="w-full shrink-0">
          <div style={{ height: accentH, backgroundColor: PAARSIV_ID.green }} />
          <div
            className="flex items-center justify-center"
            style={{
              height: footerH,
              backgroundColor: PAARSIV_ID.footerBg,
            }}
          >
            <span
              className="lowercase"
              style={{
                color: PAARSIV_ID.footerText,
                fontSize: Math.max(9, 10 * k),
                letterSpacing: '0.01em',
                fontWeight: 400,
                fontFamily: TYPEFACE,
              }}
            >
              {website}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaarsivIdCard;
