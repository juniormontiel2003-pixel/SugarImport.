# Flujo de Navegación y Consumo de API

Este diagrama de flujo ilustra cómo interactúa el usuario (tanto público como administrador) con las páginas del frontend y los endpoints del backend.

```mermaid
flowchart TD
    %% Roles de usuario
    Client([👤 Cliente / Visitante])
    Admin([🛡️ Administrador])

    %% Páginas Públicas
    subgraph Frontend_Publico [Interfaz Pública]
        Home["🏠 index.html"]
    end

    %% Login y Admin
    subgraph Frontend_Admin [Interfaz de Administración]
        Login["🔐 login.html"]
        AdminPanel["⚙️ admin.html"]
    end

    %% API Backend
    subgraph API_REST [Rutas del Servidor Express]
        ApiSettings{GET /api/settings}
        ApiProducts{GET /api/products}
        
        AuthLogin{POST /api/auth/login}
        AuthVerify{GET /api/auth/verify}
        
        ApiSettingsPut{PUT /api/settings}
        ApiProductsCRUD{CRUD /api/products}
        ApiUsersCRUD{CRUD /api/users}
    end

    %% Flujos del Cliente
    Client -->|Navega a| Home
    Home -->|Solicita estilos y textos| ApiSettings
    Home -->|Solicita inventario público| ApiProducts
    
    %% Flujos del Administrador
    Admin -->|Accede a| Login
    Login -->|Envía Username/Password| AuthLogin
    AuthLogin -->|Retorna Token JWT (Éxito)| AdminPanel
    AuthLogin -->|Error de credenciales| Login
    
    %% Acciones dentro del Panel de Control
    AdminPanel -->|Verifica Token / Sesión| AuthVerify
    AdminPanel -->|Guarda personalización UI| ApiSettingsPut
    AdminPanel -->|Gestiona Inventario (Agregar/Editar/Eliminar)| ApiProductsCRUD
    AdminPanel -->|Control de Cuentas (Crear/Asignar Roles)| ApiUsersCRUD
```
