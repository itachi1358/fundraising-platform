import { Link } from 'react-router-dom';
import {
  CAMPAIGN_PLACEHOLDER,
  categoryLabel,
  formatCurrency,
  getDaysLeft,
  getProgress
} from '../utils/campaigns';
import './CampaignCard.css';

export default function CampaignCard({ campaign }) {
  const progress = getProgress(campaign);
  const daysLeft = getDaysLeft(campaign.deadline);
  const status = campaign.status || 'active';

  return (
    <article className="cc-campaign-card">
      <Link to={`/campaigns/${campaign.id}`} className="cc-campaign-card__image-link" aria-label={`View ${campaign.title}`}>
        <img
          src={campaign.image}
          alt=""
          className="cc-campaign-card__image"
          onError={(event) => { event.currentTarget.src = CAMPAIGN_PLACEHOLDER; }}
        />
        <span className="cc-campaign-card__category">{categoryLabel(campaign.category)}</span>
        {status !== 'active' && <span className={`cc-campaign-card__status cc-campaign-card__status--${status}`}>{status}</span>}
      </Link>
      <div className="cc-campaign-card__body">
        <div className="cc-campaign-card__meta">
          <span>{campaign.creatorName}</span>
          {daysLeft && <span className={daysLeft === 'Ended' ? 'cc-campaign-card__ended' : ''}>{daysLeft}</span>}
        </div>
        <h3><Link to={`/campaigns/${campaign.id}`}>{campaign.title}</Link></h3>
        <p className="cc-campaign-card__description">{campaign.description || 'Support this verified NIT Raipur fundraising request.'}</p>
        <div className="cc-progress" aria-label={`${Math.round(progress)} percent funded`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="cc-campaign-card__funding">
          <strong>{formatCurrency(campaign.raisedAmount)} <small>raised</small></strong>
          <span>of {formatCurrency(campaign.goalAmount)}</span>
        </div>
        <Link to={`/campaigns/${campaign.id}`} className="cc-campaign-card__action">
          {status === 'closed' ? 'View campaign' : 'View & donate'} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
