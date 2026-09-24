import { MobileDemoApp } from '../mobile-demo/MobileDemoApp';
import { MobilePhoneFrame } from '../mobile-demo/MobilePhoneFrame';
import './MobilePreviewPage.css';

export function MobilePreviewPage() {
  return (
    <div className="mobile-preview">
      <header className="mobile-preview-header">
        <div>
          <h1 className="mobile-preview-title">Mobile preview</h1>
          <p className="mobile-preview-help">
            In-app ESS demo styled like PeopleOS web — no Expo server required.
            You can also open this from the sign-in page smartphone icon.
          </p>
        </div>
      </header>

      <div className="mobile-preview-stage">
        <MobilePhoneFrame>
          <MobileDemoApp />
        </MobilePhoneFrame>
      </div>
    </div>
  );
}
