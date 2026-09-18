import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { Home } from './pages/home/home';
import { StartTransaction } from './pages/start-transaction/start-transaction';
import { TransactionBuyer } from './pages/transaction-buyer/transaction-buyer';
import { TransactionSeller } from './pages/transaction-seller/transaction-seller';
import { PaymentReturn } from './pages/payment-return/payment-return';
import { BankDetails } from './pages/bank-details/bank-details';
import { Terms } from './pages/terms/terms';
import { Faq } from './pages/faq/faq';
import { Admin } from './pages/admin/admin';
import { AdminHome } from './pages/admin-home/admin-home';
import { AdminReports } from './pages/admin-reports/admin-reports';
import { SystemFailures } from './pages/system-failures/system-failures';
import { AwsLogs } from './pages/aws-logs/aws-logs';
import { NotFound } from './pages/not-found/not-found';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'start', component: StartTransaction },
  { path: 'transaction/:id/buyer', component: TransactionBuyer },
  { path: 'transaction/:id/seller', component: TransactionSeller },
  { path: 'payment-return', component: PaymentReturn },
  { path: 'bank-details/:id', component: BankDetails },
  { path: 'terms', component: Terms },
  { path: 'faq', component: Faq },
  { path: 'admin', component: Admin, pathMatch: 'full' },
  { path: 'admin/dashboard', component: AdminHome, canActivate: [adminGuard], pathMatch: 'full' },
  { path: 'admin/operations', component: Admin, canActivate: [adminGuard] },
  { path: 'admin/transactions', component: Admin, canActivate: [adminGuard] },
  { path: 'admin/users', component: Admin, canActivate: [adminGuard] },
  { path: 'admin/stats', component: Admin, canActivate: [adminGuard] },
  { path: 'admin/audit', component: Admin, canActivate: [adminGuard] },
  { path: 'admin/payouts', component: Admin, canActivate: [adminGuard] },
  { path: 'admin/reconciliation', component: Admin, canActivate: [adminGuard] },
  { path: 'admin/system-failures', component: SystemFailures, canActivate: [adminGuard] },
  { path: 'admin/aws-logs', component: AwsLogs, canActivate: [adminGuard] },
  { path: 'admin/reports', component: AdminReports, canActivate: [adminGuard] },
  { path: '**', component: NotFound },
];
