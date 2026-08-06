import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createCampaignRequest } from '../api/campaigns';
import { CATEGORY_LABELS, CAMPAIGN_PLACEHOLDER } from '../utils/campaigns';
import './CreateCampaign.css';

const initialForm = {
  title: '',
  category: '',
  goalAmount: '',
  deadline: '',
  description: '',
  reason: '',
  contactNumber: '',
  payoutDetails: '',
  bannerImageUrl: '',
  declaration: false
};

const today = new Date().toISOString().slice(0, 10);

function getErrorMessage(error) {
  const errors = error.response?.data?.errors;
  if (Array.isArray(errors) && errors.length) return errors.map((item) => item.message || item).join(' ');
  return error.response?.data?.message || 'We could not submit your request. Please try again.';
}

export default function CreateCampaign() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [bannerFile, setBannerFile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [previewUrl, setPreviewUrl] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState(null);

  useEffect(() => {
    if (!bannerFile) {
      setPreviewUrl(form.bannerImageUrl.trim());
      return undefined;
    }
    const objectUrl = URL.createObjectURL(bannerFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [bannerFile, form.bannerImageUrl]);

  const fieldCount = useMemo(() => Object.entries(initialForm).filter(([key]) => key !== 'bannerImageUrl' && key !== 'declaration').length, []);
  const completedFields = Object.entries(form).filter(([key, value]) => key !== 'bannerImageUrl' && key !== 'declaration' && value).length;

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((previous) => ({ ...previous, [name]: type === 'checkbox' ? checked : value }));
    setErrors((previous) => ({ ...previous, [name]: undefined }));
  }

  function handleBanner(event) {
    const selected = event.target.files?.[0] || null;
    if (selected && !selected.type.startsWith('image/')) {
      setErrors((previous) => ({ ...previous, bannerImage: 'Choose an image file (JPG, PNG, or WebP).' }));
      event.target.value = '';
      return;
    }
    setBannerFile(selected);
    setErrors((previous) => ({ ...previous, bannerImage: undefined }));
  }

  function handleDocuments(event) {
    const selected = Array.from(event.target.files || []).slice(0, 5);
    setDocuments(selected);
  }

  function validate() {
    const nextErrors = {};
    if (form.title.trim().length < 5) nextErrors.title = 'Use a clear title with at least 5 characters.';
    if (!form.category) nextErrors.category = 'Choose the category that best fits your request.';
    if (Number(form.goalAmount) < 1000) nextErrors.goalAmount = 'The goal amount must be at least ₹1,000.';
    if (!form.deadline || new Date(`${form.deadline}T23:59:59`).getTime() < Date.now()) nextErrors.deadline = 'Choose a future deadline.';
    if (form.description.trim().length < 40) nextErrors.description = 'Please share at least 40 characters so reviewers understand the request.';
    if (form.reason.trim().length < 15) nextErrors.reason = 'Briefly explain why this support is needed.';
    if (!/^[+\d][\d\s()-]{7,19}$/.test(form.contactNumber.trim())) nextErrors.contactNumber = 'Enter a valid phone number so we can contact you.';
    if (!form.declaration) nextErrors.declaration = 'Please confirm that the details are accurate.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function buildPayload() {
    const fields = {
      title: form.title.trim(),
      description: form.description.trim(),
      reason: form.reason.trim(),
      category: form.category,
      goalAmount: Number(form.goalAmount),
      deadline: form.deadline,
      contactNumber: form.contactNumber.trim(),
      bankDetails: form.payoutDetails.trim(),
      bannerImage: form.bannerImageUrl.trim()
    };
    if (!bannerFile && documents.length === 0) return fields;

    const payload = new FormData();
    Object.entries(fields).forEach(([key, value]) => { if (value !== '') payload.append(key, value); });
    if (bannerFile) payload.append('bannerImage', bannerFile);
    documents.forEach((file) => payload.append('documents', file));
    return payload;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const response = await createCampaignRequest(buildPayload());
      setSubmittedRequest(response.data?.request || response.data?.campaign || response.data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedRequest) {
    return (
      <main className="cc-request-page">
        <section className="cc-request-success" aria-labelledby="request-success-title">
          <div className="cc-request-success__mark" aria-hidden="true">✓</div>
          <span className="cc-section-kicker">Request received</span>
          <h1 id="request-success-title">Your campaign is now with our review team.</h1>
          <p>We’ll verify the information and notify you at your NIT Raipur email once a decision is made. Requests normally take 24–48 hours.</p>
          {submittedRequest._id && <p className="cc-request-success__id">Reference: {submittedRequest._id}</p>}
          <div className="cc-request-success__actions"><Link to="/my-campaigns">Track my request</Link><Link to="/dashboard" className="cc-request-success__secondary">Back to campaigns</Link></div>
        </section>
      </main>
    );
  }

  return (
    <main className="cc-request-page">
      <div className="cc-request-page__intro">
        <div>
          <Link to="/dashboard" className="cc-back-link">← Back to campaigns</Link>
          <span className="cc-section-kicker">Request support</span>
          <h1>Tell us how the community can help.</h1>
          <p>Submit a campaign request for review. We only publish verified requests, so your supporters can give with confidence.</p>
        </div>
        <aside className="cc-request-progress" aria-label="Form completion progress">
          <span>Application progress</span>
          <strong>{Math.round((completedFields / fieldCount) * 100)}%</strong>
          <div><i style={{ width: `${(completedFields / fieldCount) * 100}%` }} /></div>
          <small>Required details completed</small>
        </aside>
      </div>

      <div className="cc-request-layout">
        <form className="cc-request-form" onSubmit={handleSubmit} noValidate>
          {submitError && <div className="cc-form-alert" role="alert"><strong>Submission wasn’t successful.</strong><span>{submitError}</span></div>}

          <section className="cc-form-section" aria-labelledby="campaign-basics">
            <div className="cc-form-section__heading"><span>01</span><div><h2 id="campaign-basics">Campaign basics</h2><p>Start with the essentials supporters will see.</p></div></div>
            <div className="cc-form-grid">
              <label className="cc-field cc-field--full">Campaign title <em>*</em><input name="title" value={form.title} onChange={handleChange} placeholder="e.g. Emergency surgery support for a student" maxLength="120" aria-invalid={Boolean(errors.title)} />{errors.title && <small className="cc-field-error">{errors.title}</small>}</label>
              <label className="cc-field">Category <em>*</em><select name="category" value={form.category} onChange={handleChange} aria-invalid={Boolean(errors.category)}><option value="">Select a category</option>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{errors.category && <small className="cc-field-error">{errors.category}</small>}</label>
              <label className="cc-field">Goal amount <em>*</em><span className="cc-money-input"><b>₹</b><input type="number" name="goalAmount" value={form.goalAmount} onChange={handleChange} min="1000" step="500" placeholder="50,000" aria-invalid={Boolean(errors.goalAmount)} /></span>{errors.goalAmount && <small className="cc-field-error">{errors.goalAmount}</small>}</label>
              <label className="cc-field">Fundraising deadline <em>*</em><input type="date" name="deadline" value={form.deadline} onChange={handleChange} min={today} aria-invalid={Boolean(errors.deadline)} />{errors.deadline && <small className="cc-field-error">{errors.deadline}</small>}</label>
              <label className="cc-field">Contact number <em>*</em><input type="tel" name="contactNumber" value={form.contactNumber} onChange={handleChange} placeholder="+91 98765 43210" aria-invalid={Boolean(errors.contactNumber)} />{errors.contactNumber && <small className="cc-field-error">{errors.contactNumber}</small>}</label>
            </div>
          </section>

          <section className="cc-form-section" aria-labelledby="campaign-story">
            <div className="cc-form-section__heading"><span>02</span><div><h2 id="campaign-story">Your story</h2><p>Be specific about the need and how the funds will help.</p></div></div>
            <div className="cc-form-grid">
              <label className="cc-field cc-field--full">Campaign description <em>*</em><textarea name="description" value={form.description} onChange={handleChange} placeholder="Explain the situation, the impact this assistance will have, and what the funds will cover." rows="6" maxLength="3000" aria-invalid={Boolean(errors.description)} /> <span className="cc-character-count">{form.description.length}/3000</span>{errors.description && <small className="cc-field-error">{errors.description}</small>}</label>
              <label className="cc-field cc-field--full">Why are you requesting support? <em>*</em><textarea name="reason" value={form.reason} onChange={handleChange} placeholder="Give reviewers a short summary of the immediate need." rows="3" maxLength="800" aria-invalid={Boolean(errors.reason)} />{errors.reason && <small className="cc-field-error">{errors.reason}</small>}</label>
            </div>
          </section>

          <section className="cc-form-section" aria-labelledby="campaign-media">
            <div className="cc-form-section__heading"><span>03</span><div><h2 id="campaign-media">Images & documents</h2><p>Optional, but helpful for verification and a clear campaign page.</p></div></div>
            <div className="cc-form-grid">
              <label className="cc-field cc-field--full">Banner image URL <span className="cc-optional">optional</span><input type="url" name="bannerImageUrl" value={form.bannerImageUrl} onChange={handleChange} placeholder="https://example.com/campaign-image.jpg" /></label>
              <div className="cc-file-field cc-field--full">
                <span>Or upload a banner image <span className="cc-optional">optional</span></span>
                <label className="cc-file-drop"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleBanner} /><span aria-hidden="true">↑</span><strong>{bannerFile ? bannerFile.name : 'Choose an image'}</strong><small>JPG, PNG, or WebP · up to your server’s upload limit</small></label>
                {errors.bannerImage && <small className="cc-field-error">{errors.bannerImage}</small>}
              </div>
              {(previewUrl || bannerFile) && <div className="cc-banner-preview cc-field--full"><img src={previewUrl || CAMPAIGN_PLACEHOLDER} alt="Campaign banner preview" onError={(event) => { event.currentTarget.src = CAMPAIGN_PLACEHOLDER; }} /><button type="button" onClick={() => { setBannerFile(null); setForm((previous) => ({ ...previous, bannerImageUrl: '' })); }}>Remove image</button></div>}
              <div className="cc-file-field cc-field--full"><span>Supporting documents <span className="cc-optional">optional</span></span><label className="cc-file-drop"><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={handleDocuments} /><span aria-hidden="true">⊕</span><strong>{documents.length ? `${documents.length} file${documents.length > 1 ? 's' : ''} selected` : 'Add supporting documents'}</strong><small>Medical reports, fee receipts, or other relevant files · max. 5</small></label>{documents.length > 0 && <ul className="cc-file-list">{documents.map((file) => <li key={`${file.name}-${file.lastModified}`}>{file.name} <button type="button" onClick={() => setDocuments((files) => files.filter((item) => item !== file))} aria-label={`Remove ${file.name}`}>×</button></li>)}</ul>}</div>
            </div>
          </section>

          <section className="cc-form-section" aria-labelledby="payout-details">
            <div className="cc-form-section__heading"><span>04</span><div><h2 id="payout-details">Payout details</h2><p>Share optional information for the review team; it is never displayed publicly.</p></div></div>
            <label className="cc-field">UPI ID or bank details <span className="cc-optional">optional</span><textarea name="payoutDetails" value={form.payoutDetails} onChange={handleChange} placeholder="UPI ID, or account holder name / account number / IFSC" rows="3" maxLength="700" /></label>
          </section>

          <section className="cc-declaration">
            <label><input type="checkbox" name="declaration" checked={form.declaration} onChange={handleChange} /><span>I confirm that the information in this request is accurate, and I understand it will be verified before publication. <em>*</em></span></label>
            {errors.declaration && <small className="cc-field-error">{errors.declaration}</small>}
          </section>
          <div className="cc-form-actions"><button className="cc-primary-button" type="submit" disabled={submitting}>{submitting ? 'Submitting request…' : 'Submit for review'} <span aria-hidden="true">→</span></button><button type="button" className="cc-secondary-button" onClick={() => navigate('/dashboard')}>Cancel</button></div>
        </form>

        <aside className="cc-request-aside">
          <div className="cc-request-aside__card"><span className="cc-request-aside__icon" aria-hidden="true">✓</span><h2>What happens next?</h2><ol><li><b>We review</b><span>Our team checks your submitted information.</span></li><li><b>We notify you</b><span>You’ll receive an email after approval or if we need more details.</span></li><li><b>Your campaign goes live</b><span>Approved campaigns appear on the CareConnect dashboard.</span></li></ol></div>
          <div className="cc-request-aside__help"><strong>Need immediate support?</strong><p>Please contact your department or the student welfare office directly for urgent assistance.</p></div>
        </aside>
      </div>
    </main>
  );
}
