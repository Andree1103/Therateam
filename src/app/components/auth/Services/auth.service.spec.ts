import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthService, User } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: routerSpy },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('login guarda el token y el usuario en localStorage', () => {
    let resultado: User | undefined;
    service.login('ana@therateam.com', 'clave123').subscribe(u => resultado = u);

    const req = httpMock.expectOne(`${environment.apiUrl}/api/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush({
      token: 'jwt-de-prueba', id: 1, nombre: 'Ana', apellido: 'Gómez', email: 'ana@therateam.com',
      rol: 'ADMIN', modulos: ['PACIENTES'], permisos: [], terapeutaId: null,
      citasSoloPropias: false, citasPuedeCrear: true,
    });

    expect(resultado?.nombre).toBe('Ana');
    expect(localStorage.getItem('auth_token')).toBe('jwt-de-prueba');
    expect(service.currentUserValue?.email).toBe('ana@therateam.com');
  });

  it('logout borra el token/usuario y redirige a /login', () => {
    localStorage.setItem('auth_token', 'algo');
    localStorage.setItem('user_data', '{"nombre":"Ana"}');

    service.logout();

    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('user_data')).toBeNull();
    expect(service.currentUserValue).toBeNull();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('isAuthenticated refleja si hay un token guardado', () => {
    expect(service.isAuthenticated()).toBeFalse();
    localStorage.setItem('auth_token', 'token');
    expect(service.isAuthenticated()).toBeTrue();
  });

  describe('permisos granulares (puedeCrear/puedeEditar/puedeEliminar)', () => {
    beforeEach(() => {
      let resultado: User | undefined;
      service.login('t@therateam.com', 'x').subscribe(u => resultado = u);
      httpMock.expectOne(`${environment.apiUrl}/api/auth/login`).flush({
        token: 'jwt', id: 2, nombre: 'Jarol', apellido: 'Chiquis', email: 't@therateam.com',
        rol: 'TERAPEUTA', modulos: ['CITAS', 'PACIENTES'],
        permisos: [{ modulo: 'CITAS', crear: false, editar: true, eliminar: false }],
        terapeutaId: 1, citasSoloPropias: true, citasPuedeCrear: false,
      });
    });

    it('devuelve true/false según el permiso exacto del módulo', () => {
      expect(service.puedeCrear('CITAS')).toBeFalse();
      expect(service.puedeEditar('CITAS')).toBeTrue();
      expect(service.puedeEliminar('CITAS')).toBeFalse();
    });

    it('un módulo sin entrada en permisos se trata como sin acceso de escritura', () => {
      expect(service.puedeCrear('PAGOS')).toBeFalse();
      expect(service.puedeEditar('PAGOS')).toBeFalse();
      expect(service.puedeEliminar('PAGOS')).toBeFalse();
    });

    it('tieneModulo refleja la lista de módulos del token', () => {
      expect(service.tieneModulo('CITAS')).toBeTrue();
      expect(service.tieneModulo('SEGURIDAD')).toBeFalse();
    });

    it('puedeCrearCitas respeta la restricción citasPuedeCrear del usuario', () => {
      expect(service.puedeCrearCitas()).toBeFalse();
    });
  });
});
