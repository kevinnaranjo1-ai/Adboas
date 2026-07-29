# Sistema de Gestão de Membros - Igreja

Este é um sistema de gestão e relatórios para igrejas, construído com React, Tailwind CSS e Firebase.

## Como configurar o ambiente de desenvolvimento

1.  **Clonar o repositório:**
    ```bash
    git clone <url-do-seu-repositorio>
    cd <nome-do-diretorio>
    ```

2.  **Instalar dependências:**
    ```bash
    npm install
    ```

3.  **Configurar o Firebase:**
    Este projeto utiliza o Firebase para autenticação e banco de dados (Firestore).
    - Crie um projeto no [Console do Firebase](https://console.firebase.google.com/).
    - Ative o **Google Auth** e o **Firestore**.
    - Copie as credenciais do seu app web.
    - Crie um arquivo chamado `src/lib/firebase-applet-config.json` (caso ele não tenha sido exportado) com o seguinte formato:
    ```json
    {
      "apiKey": "SUA_API_KEY",
      "authDomain": "SEU_PROJETO.firebaseapp.com",
      "projectId": "SEU_PROJETO",
      "storageBucket": "SEU_PROJETO.appspot.com",
      "messagingSenderId": "SEU_ID",
      "appId": "SEU_APP_ID",
      "firestoreDatabaseId": "(default)"
    }
    ```

4.  **Regras do Firestore:**
    As regras de segurança estão no arquivo `firestore.rules`. Você deve fazer o deploy delas para o seu console do Firebase no menu "Firestore -> Rules".

5.  **Rodar o projeto Localmente:**
    ```bash
    npm run dev
    ```
    O servidor iniciará (geralmente em localhost:3000 ou 5173).

## Estrutura do Projeto

- `src/pages/admin`: Gerenciamento de membros, obreiros e departamentos.
- `src/pages/ReportForm.tsx`: Formulário de envio de relatórios pastorais e de departamentos.
- `src/components/BirthdayPicker.tsx`: Componente customizado para seleção de datas (Nascimento, Batismo, etc).
- `firestore.rules`: Lógica de segurança robusta para proteção de dados de membros.
