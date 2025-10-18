import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        
        <p className="text-muted-foreground mb-8">
          <strong>Last updated:</strong> January 18, 2025
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
          <p className="mb-4">
            We collect information that you provide directly to us when you use our Millennial Reign App. This includes:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li><strong>Personal Information:</strong> Name, email address, phone number, address, and congregation details</li>
            <li><strong>Contact Information:</strong> Phone numbers and addresses for emergency contact purposes</li>
            <li><strong>Location Data:</strong> Address coordinates for congregation management and emergency purposes</li>
            <li><strong>Service Records:</strong> Monthly and daily field service reports, Bible study information</li>
            <li><strong>Business Records:</strong> Establishment and householder information for witnessing work</li>
            <li><strong>Usage Data:</strong> How you interact with our app, including performance metrics</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
          <p className="mb-4">We use your information for the following purposes:</p>
          <ul className="list-disc pl-6 mb-4">
            <li><strong>Congregation Management:</strong> Organizing congregation activities, assignments, and communication</li>
            <li><strong>Emergency Contact:</strong> Providing contact information to congregation elders for emergency situations</li>
            <li><strong>Service Reporting:</strong> Tracking and reporting field service activities as required by congregation policies</li>
            <li><strong>Business Witnessing:</strong> Managing establishment and householder records for organized witnessing work</li>
            <li><strong>App Functionality:</strong> Providing personalized features and improving user experience</li>
            <li><strong>Communication:</strong> Sending important updates, notifications, and congregation announcements</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. Who Can Access Your Information</h2>
          <p className="mb-4">Access to your information is restricted based on your role and congregation needs:</p>
          <ul className="list-disc pl-6 mb-4">
            <li><strong>Your Own Information:</strong> You can always view and edit your own profile and contact information</li>
            <li><strong>Congregation Elders:</strong> Can view contact information of members in their congregation for emergency purposes</li>
            <li><strong>Congregation Members:</strong> Can view basic profile information (name, privileges) of other members in their congregation</li>
            <li><strong>Administrators:</strong> Have access to congregation management features and user administration</li>
            <li><strong>Third-Party Services:</strong> Limited data sharing with Supabase (database hosting) and Vercel (app hosting) for technical functionality</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Data Security</h2>
          <p className="mb-4">We implement appropriate security measures to protect your information:</p>
          <ul className="list-disc pl-6 mb-4">
            <li><strong>Encryption:</strong> All data is encrypted in transit and at rest</li>
            <li><strong>Access Controls:</strong> Role-based permissions ensure only authorized users can access sensitive information</li>
            <li><strong>Authentication:</strong> Secure login with optional biometric authentication for mobile devices</li>
            <li><strong>Database Security:</strong> Row-level security policies prevent unauthorized data access</li>
            <li><strong>Regular Updates:</strong> Security patches and updates are applied regularly</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Your Rights</h2>
          <p className="mb-4">You have the following rights regarding your personal information:</p>
          <ul className="list-disc pl-6 mb-4">
            <li><strong>Access:</strong> View all information we have about you</li>
            <li><strong>Correction:</strong> Update or correct any inaccurate information</li>
            <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
            <li><strong>Portability:</strong> Export your data in a standard format</li>
            <li><strong>Restriction:</strong> Limit how your information is processed</li>
            <li><strong>Objection:</strong> Object to certain uses of your information</li>
          </ul>
          <p className="mb-4">
            To exercise these rights, contact your congregation elders or use the account settings in the app.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Cookies and Analytics</h2>
          <p className="mb-4">We use the following technologies to improve our service:</p>
          <ul className="list-disc pl-6 mb-4">
            <li><strong>Essential Cookies:</strong> Required for app functionality and authentication</li>
            <li><strong>Performance Analytics:</strong> Vercel Speed Insights to monitor app performance and user experience</li>
            <li><strong>Push Notifications:</strong> Browser-based notifications for important updates (with your consent)</li>
            <li><strong>Local Storage:</strong> Offline functionality and app preferences</li>
          </ul>
          <p className="mb-4">
            You can control cookie settings through your browser preferences. Disabling certain cookies may affect app functionality.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Third-Party Services</h2>
          <p className="mb-4">We use the following third-party services:</p>
          <ul className="list-disc pl-6 mb-4">
            <li><strong>Supabase:</strong> Database hosting and authentication services</li>
            <li><strong>Vercel:</strong> Application hosting and performance monitoring</li>
            <li><strong>Push Notification Services:</strong> Apple Push Notification Service and Google Cloud Messaging for notifications</li>
          </ul>
          <p className="mb-4">
            These services have their own privacy policies and security measures. We ensure they meet our privacy standards.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. Data Retention</h2>
          <p className="mb-4">
            We retain your information for as long as necessary to provide our services and comply with legal obligations:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li><strong>Active Accounts:</strong> Information is retained while your account is active</li>
            <li><strong>Service Records:</strong> Field service records are retained according to congregation policies</li>
            <li><strong>Business Records:</strong> Establishment and householder information is retained for ongoing witnessing work</li>
            <li><strong>Deleted Accounts:</strong> Data is permanently deleted within 30 days of account deletion</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. Children's Privacy</h2>
          <p className="mb-4">
            Our app is designed for use by congregation members of all ages. For users under 18, we require parental consent for account creation and data collection. Parents can request access to or deletion of their child's information at any time.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">10. Changes to Privacy Policy</h2>
          <p className="mb-4">
            We may update this privacy policy from time to time. We will notify you of any material changes by:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Posting the updated policy on our app</li>
            <li>Sending notifications through the app</li>
            <li>Email notifications for significant changes</li>
          </ul>
          <p className="mb-4">
            Your continued use of the app after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">11. Contact Us</h2>
          <p className="mb-4">
            If you have any questions about this privacy policy or our data practices, please contact:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Your congregation elders</li>
            <li>App administrators through the account settings</li>
            <li>Email: privacy@millennialreign.app</li>
          </ul>
        </section>

        <div className="mt-12 pt-8 border-t">
          <p className="text-sm text-muted-foreground">
            This privacy policy is effective as of January 18, 2025, and applies to all users of the Millennial Reign App.
          </p>
        </div>
      </div>
    </div>
  );
}
