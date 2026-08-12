import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { RulesComponent } from './pages/rules/rules.component';
import { WorldComponent } from './pages/world/world.component';
import { ContactsComponent } from './pages/contacts/contacts.component';
import { StoreComponent } from './pages/store/store.component';
import { SupportComponent } from './pages/support/support.component';
import { PrivacyComponent } from './pages/privacy/privacy.component';
import { TermsComponent } from './pages/terms/terms.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'store', component: StoreComponent },
  { path: 'donate', redirectTo: 'store', pathMatch: 'full' },
  { path: 'rules', component: RulesComponent },
  { path: 'world', component: WorldComponent },
  { path: 'contacts', component: ContactsComponent },
  { path: 'support', component: SupportComponent },
  { path: 'privacy', component: PrivacyComponent },
  { path: 'terms', component: TermsComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'top' })],
  exports: [RouterModule]
})
export class AppRoutingModule { }

