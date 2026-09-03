import { Component, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { calcStandardFee, calcExpressFee, formatZar } from '../../utils/fee';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './home.html',
})
export class Home {
  dealAmount = signal<number | null>(null);

  standardFee = computed(() => calcStandardFee(this.dealAmount() ?? 0));
  expressFee = computed(() => calcExpressFee(this.dealAmount() ?? 0));
  formatCurrency = formatZar;

  onAmountChange(val: string) {
    this.dealAmount.set(parseFloat(val) || null);
  }

  scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  faqs = [
    {
      q: '1. What is SecureX and what does it do?',
      a: 'SecureX is an independent, South African digital escrow platform purpose-built to eliminate fraud in the peer-to-peer marketplace. By combining a secure, segregated Partner Account with automated identity verification and optional physical item verification, SecureX ensures neither Buyers nor Sellers are exposed to the risks of transacting with strangers online.'
    },
    {
      q: '2. Is SecureX a bank? Is my money safe?',
      a: 'No. SecureX is not a bank or financial institution. SecureX acts exclusively as a neutral escrow intermediary. Client funds are held in a segregated Partner Account facilitated by regulated Banking-as-a-Service partners — never in SecureX\'s own corporate accounts.'
    },
    {
      q: '3. What does SecureX charge?',
      a: 'Standard Escrow: 2.5% of the transaction value, minimum R150.00. Verified Express: 1.5% of the transaction value plus a flat R250.00. All fees are disclosed before any funds are deposited. No hidden fees, no cancellation fees.'
    },
    {
      q: '4. Do I have to be verified to use the Platform?',
      a: 'Yes. Verification is mandatory for all users. Buyers undergo identity and AML screening. Sellers complete biometric liveness detection and bank account verification (AVS). The process is fully automated, done from your smartphone, and takes less than 2 minutes.'
    },
    {
      q: '5. What happens if I am unhappy with the item I received?',
      a: 'Formally reject the item through the Platform within your 24-hour inspection window. This immediately freezes all funds and triggers SecureX\'s 72-hour dispute adjudication process. If the determination favours you, a full refund is processed automatically.'
    },
    {
      q: '6. What is the Verified Express Service?',
      a: 'The Verified Express Service is SecureX\'s premium, agent-assisted tier for higher-value transactions. An authorised SecureX agent physically inspects the item and witnesses the handover to the courier. Funds are released to the Seller immediately upon the agent\'s confirmation.'
    },
    {
      q: '7. What should I do if I receive a suspicious message claiming to be from SecureX?',
      a: 'Do not act on it. All official SecureX communications reference your unique Deal Reference number. SecureX will never ask you to pay a personal bank account or bypass the Platform. Report suspicious messages to info@secureexchange.co.za.'
    },
  ];
}
