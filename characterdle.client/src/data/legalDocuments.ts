import type { Page } from '../types/routes';

interface LegalDocumentSection {
  bullets?: string[];
  paragraphs?: string[];
  title: string;
}

export interface LegalDocument {
  description: string;
  effectiveOn: string;
  page: Extract<Page, 'privacyPolicy' | 'termsOfService'>;
  sections: LegalDocumentSection[];
  title: string;
  updatedOn: string;
}

const supportEmail = 'support@characterdle.com';

export const legalDocuments: Record<LegalDocument['page'], LegalDocument> = {
  privacyPolicy: {
    description: 'How Characterdle collects, uses, stores, and shares account, gameplay, and support data.',
    effectiveOn: 'July 4, 2026',
    page: 'privacyPolicy',
    title: 'Privacy Policy',
    updatedOn: 'July 4, 2026',
    sections: [
      {
        title: 'Overview',
        paragraphs: [
          'Characterdle is a daily guessing game service. This Privacy Policy explains what information we collect, how we use it, and the choices you have when you use the site.',
          `If you have questions about privacy or data handling, contact ${supportEmail}.`,
        ],
      },
      {
        title: 'Operator and controller',
        paragraphs: [
          'Characterdle is operated by Curtis Jones, who is responsible for the information collected through the service.',
          `For privacy questions, support requests, or data-related inquiries, contact ${supportEmail}.`,
        ],
      },
      {
        title: 'Information we collect',
        bullets: [
          'Account information you provide, such as username, email address, and selected profile image.',
          'Gameplay information, such as wins, losses, guesses, hints used, streaks, leaderboard placements, and archived game progress.',
          'Public profile and leaderboard information, such as username, profile image, score, streak, and leaderboard placement, may be visible to other users.',
          'Support information you send us by email, including attachments, screenshots, or other details you choose to share.',
          'Technical information needed to operate the service, such as browser type, approximate timestamps, request logs, IP address where applicable, and basic device metadata.',
          'Local browser storage data used to remember authentication state, guest progress, archived results, in-progress games, and pseudonymous participant IDs.',
          'Advertising or cookie-related data if ads are enabled on the site.',
        ],
      },
      {
        title: 'How we use information',
        bullets: [
          'To create and manage player accounts.',
          'To save game results, streaks, archived games, and leaderboard standings.',
          'To restore in-progress or archived gameplay where supported.',
          'To respond to support requests, bug reports, and account questions.',
          'To improve reliability, performance, anti-abuse protections, premium features, and other paid services.',
          'To operate advertising or related monetization features if enabled on the site.',
          'To comply with legal, security, and fraud-prevention obligations.',
        ],
      },
      {
        title: 'Public leaderboards and profiles',
        paragraphs: [
          'If you create an account and participate in Characterdle features, some profile and gameplay information may be visible to other users. This can include usernames, profile images, scores, streaks, leaderboard placements, and similar gameplay statistics.',
          'If you do not want certain information to be visible to other users, do not include personal information in your username or profile image.',
        ],
      },
      {
        title: 'Cookies, local storage, and similar technologies',
        paragraphs: [
          'Characterdle uses local storage and similar technologies to remember authentication state, guest progress, archived results, in-progress games, and pseudonymous play identifiers.',
          'Third-party services may use cookies or similar technologies to provide security, analytics, fraud prevention, hosting, or advertising.',
          'You can control cookies and storage through your browser settings, but disabling them may break gameplay, login, or saved progress.',
        ],
      },
      {
        title: 'Advertising',
        paragraphs: [
          'If ads are enabled on Characterdle, third-party vendors, including Google, may use cookies or similar technologies to serve ads based on a user\'s prior visits to Characterdle or other websites.',
          'Google\'s use of advertising cookies may enable it and its partners to serve ads to users based on visits to Characterdle and/or other sites.',
          'Users may be able to opt out of personalized advertising through Google\'s ad settings or other applicable consent tools.',
          'For users in regions where consent is required, Characterdle may display a consent banner or similar privacy controls before using certain cookies or personalized ads.',
        ],
      },
      {
        title: 'Third-party services',
        bullets: [
          'Supabase for authentication, account management, and database storage.',
          'Cloudflare for site hosting, DNS, security, and email routing.',
          'Render for backend hosting and API delivery.',
          'Google AdSense or related Google advertising services if ads are enabled.',
        ],
        paragraphs: [
          'These providers may process information only as needed to provide services such as hosting, authentication, storage, security, email routing, API delivery, and advertising.',
          'These providers also operate under their own terms and privacy policies.',
        ],
      },
      {
        title: 'Data sharing',
        paragraphs: [
          'Characterdle does not sell your personal information in the ordinary sense.',
          'We may share information with service providers that help us operate the site, with legal or safety authorities if required by law or necessary to protect users, the service, or others, and with successors in connection with a merger, acquisition, financing, reorganization, or sale of assets.',
          'Public leaderboard and profile information may also be visible to other users as part of the service.',
        ],
      },
      {
        title: 'How long we keep data',
        paragraphs: [
          'Account and gameplay data is kept while your account is active or as needed to operate Characterdle.',
          'Leaderboard and gameplay history may be retained to preserve game integrity and rankings.',
          'Guest and local-storage data remains in your browser until it is cleared or expires.',
          'Support emails may be retained for a reasonable period for troubleshooting, abuse prevention, and recordkeeping.',
          'If you delete your account, Characterdle will remove or anonymize data it is able to remove from active systems, subject to technical, legal, security, fraud-prevention, and backup limits.',
        ],
      },
      {
        title: 'Your choices and rights',
        bullets: [
          'You may update your display name and profile image from account settings.',
          'You may request password resets through the site.',
          'You may delete your account through the account settings flow when available.',
          `You may contact ${supportEmail} to request access, correction, deletion, or help with account or data requests.`,
          'You may control cookies and local storage through your browser settings.',
          'Depending on your location, you may have additional rights under privacy laws, such as the right to access, correct, delete, object to, restrict, or receive a copy of your personal information.',
        ],
      },
      {
        title: 'Security',
        paragraphs: [
          'Characterdle uses reasonable administrative, technical, and organizational safeguards to help protect information.',
          'No online service can guarantee absolute security.',
          'You should use a strong password and keep your account credentials private.',
        ],
      },
      {
        title: 'International data processing',
        paragraphs: [
          'Characterdle and its service providers may process information in the United States or other countries where they operate.',
          'Data protection laws in those countries may differ from the laws in your location.',
        ],
      },
      {
        title: 'Children and age limits',
        paragraphs: [
          'Characterdle is not intended for children under 13.',
          'You must not use the service if you are under the minimum age required in your location.',
          'Characterdle does not knowingly collect personal information from children under 13.',
          'If Characterdle learns that it collected personal information from a child under 13, it will take reasonable steps to delete it.',
          `Parents or guardians may contact ${supportEmail}.`,
        ],
      },
      {
        title: 'Changes to this policy',
        paragraphs: [
          'Characterdle may update this Privacy Policy from time to time.',
          'The latest version will be posted on this page with the updated date.',
          'Continued use of the service after changes means you accept the updated policy, where permitted by law.',
        ],
      },
    ],
  },
  termsOfService: {
    description: 'The basic terms that apply when someone uses Characterdle, creates an account, and uses leaderboards or paid services.',
    effectiveOn: 'July 4, 2026',
    page: 'termsOfService',
    title: 'Terms of Service',
    updatedOn: 'July 4, 2026',
    sections: [
      {
        title: 'Acceptance of these terms',
        paragraphs: [
          'By using Characterdle, you agree to these Terms of Service. If you do not agree, do not use the site.',
        ],
      },
      {
        title: 'Eligibility',
        paragraphs: [
          'You must be at least 13 years old to use Characterdle.',
          'You must also be old enough to use the service under the laws of your location.',
          'If you are under the age of majority in your location, you may use Characterdle only with permission from a parent or legal guardian.',
        ],
      },
      {
        title: 'Use of the service',
        bullets: [
          'You may use Characterdle for personal, non-commercial entertainment unless we give written permission otherwise.',
          'You are responsible for activity that occurs under your account.',
          'You must provide accurate account information and keep your login credentials secure.',
        ],
      },
      {
        title: 'Acceptable behavior',
        bullets: [
          'Do not attempt to break, overload, reverse engineer, scrape, or interfere with the site or its services.',
          'Do not impersonate another person or misrepresent your affiliation.',
          'Do not upload, send, or submit unlawful, abusive, or harmful material through support or account features.',
          'Do not use automation or abuse the service in a way that harms reliability or other players.',
          'Do not cheat, manipulate scores, exploit bugs, use bots, create multiple accounts to gain unfair advantages, or otherwise interfere with fair leaderboard rankings.',
        ],
      },
      {
        title: 'Accounts and leaderboards',
        paragraphs: [
          'We may suspend, limit, or remove accounts or leaderboard entries if we believe they violate these terms, create operational risk, or misuse the service.',
          'Guest play may have limited features compared with signed-in accounts.',
        ],
      },
      {
        title: 'User content and profile materials',
        paragraphs: [
          'If you submit content to Characterdle, such as a username, selected profile image, support message, screenshot, or similar material, you grant Characterdle a limited, non-exclusive, worldwide license to host, store, display, reproduce, and use that content only as needed to operate, improve, protect, and support the service.',
          'You are responsible for any content you submit. Do not submit content that infringes someone else\'s rights or contains unlawful, abusive, or harmful material.',
        ],
      },
      {
        title: 'Intellectual property',
        paragraphs: [
          'Characterdle, including its site design, code, branding, and original content, is owned by Characterdle or used with permission.',
          'All third-party names, titles, characters, trademarks, and related references belong to their respective owners.',
          'Characterdle is a fan-made project and is not affiliated with, sponsored by, approved by, or endorsed by HBO, Warner Bros. Discovery, George R. R. Martin, or any related rights holders.',
        ],
      },
      {
        title: 'Subscriptions and checkout terms',
        paragraphs: [
          'Characterdle offers paid premium subscriptions and may also offer other paid digital services.',
          'Before you purchase a subscription, we will show the price, billing frequency, renewal terms, and how to cancel.',
          'By purchasing a subscription, you authorize recurring charges until you cancel, unless stated otherwise at checkout.',
        ],
      },
      {
        title: 'Payments, taxes, and billing providers',
        paragraphs: [
          'Payments may be processed by third-party payment providers. Characterdle does not directly store full payment card numbers unless stated otherwise by the payment provider.',
          'Prices may not include taxes unless stated otherwise.',
          'If subscription prices change, we will provide notice before the new price applies to future charges where required by law. If you do not agree to a price change, you may cancel before the next billing date.',
        ],
      },
      {
        title: 'Subscription cancellation',
        paragraphs: [
          'If you signed up online, you will be able to cancel online through your account area or billing portal.',
          'We will not require you to contact support as the only way to cancel a subscription.',
          'You may cancel your subscription before your next billing cycle takes effect.',
          'If a subscription is canceled, paid access will continue through the end of the already-paid billing period unless stated otherwise at checkout.',
        ],
      },
      {
        title: 'Refund policy',
        paragraphs: [
          'Charges are generally non-refundable once access has been granted unless otherwise stated at checkout or required by law.',
          'Refund eligibility may depend on the specific plan, offer, billing provider, technical issue, and applicable law.',
        ],
        bullets: [
          'Duplicate charges caused by billing error.',
          'Technical failures that prevent access and cannot be reasonably resolved.',
          'Cases where a refund is required under applicable law.',
        ],
      },
      {
        title: 'Billing help',
        paragraphs: [
          `If billing support becomes necessary, contact ${supportEmail} with your account email, purchase date, and a description of the issue.`,
        ],
      },
      {
        title: 'Ending your use of Characterdle',
        paragraphs: [
          'You may stop using Characterdle at any time.',
          'Account deletion, subscription cancellation, and data deletion may be handled separately depending on the feature and billing provider.',
        ],
      },
      {
        title: 'Service availability',
        paragraphs: [
          'We may update, modify, pause, or discontinue any part of Characterdle at any time. We do not guarantee uninterrupted or error-free availability.',
        ],
      },
      {
        title: 'Governing law',
        paragraphs: [
          'These Terms are governed by the laws of Ohio, without regard to conflict-of-law rules, except where local consumer protection laws require otherwise.',
        ],
      },
      {
        title: 'Copyright concerns',
        paragraphs: [
          `If you believe content on Characterdle infringes your copyright or other rights, contact ${supportEmail} with enough detail for us to review the issue.`,
        ],
      },
      {
        title: 'Disclaimers',
        paragraphs: [
          'Characterdle is provided on an as-is and as-available basis. To the fullest extent allowed by law, we disclaim warranties of merchantability, fitness for a particular purpose, and non-infringement.',
        ],
      },
      {
        title: 'Limitation of liability',
        paragraphs: [
          'To the fullest extent allowed by law, Characterdle and its operators will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages arising out of your use of the service.',
        ],
      },
      {
        title: 'Changes to these terms',
        paragraphs: [
          'We may update these terms from time to time. Continued use of the service after changes are posted means you accept the updated terms.',
        ],
      },
    ],
  },
};

export function getLegalDocument(page: LegalDocument['page']): LegalDocument {
  return legalDocuments[page];
}
