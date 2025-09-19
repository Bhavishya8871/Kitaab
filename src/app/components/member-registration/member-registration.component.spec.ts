import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
// import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MemberRegistrationComponent } from './member-registration.component';

describe('MemberRegistrationComponent', () => {
  let component: MemberRegistrationComponent;
  let fixture: ComponentFixture<MemberRegistrationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MemberRegistrationComponent,
        ReactiveFormsModule,
        // RouterTestingModule,
        HttpClientTestingModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MemberRegistrationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
