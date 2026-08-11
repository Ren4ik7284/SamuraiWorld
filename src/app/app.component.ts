import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { FooterComponent } from './components/footer/footer.component';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'SamuraiWorld';
  private router = inject(Router);

  ngOnInit(): void {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.scrollToTopInstant();
    });
  }

  private scrollToTopInstant(): void {
    const htmlEl = document.documentElement;
    const bodyEl = document.body;

    const reset = () => {
      const origHtmlScroll = htmlEl.style.scrollBehavior;
      const origBodyScroll = bodyEl.style.scrollBehavior;
      htmlEl.style.scrollBehavior = 'auto';
      bodyEl.style.scrollBehavior = 'auto';

      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      htmlEl.scrollTop = 0;
      bodyEl.scrollTop = 0;

      setTimeout(() => {
        htmlEl.style.scrollBehavior = origHtmlScroll;
        bodyEl.style.scrollBehavior = origBodyScroll;
      }, 50);
    };

    reset();
    requestAnimationFrame(reset);
    setTimeout(reset, 50);
    setTimeout(reset, 150);
  }
}
