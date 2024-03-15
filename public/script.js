document.addEventListener("DOMContentLoaded", function() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const resetForm = document.getElementById('resetForm');
    const loginMessage = document.getElementById('loginMessage');
    const signupMessage = document.getElementById('signupMessage');
    const resetMessage = document.getElementById('resetMessage');

    loginForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const formData = new FormData(loginForm);
        const email = formData.get('email');
        const password = formData.get('password');

        fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        })
        .then(response => response.json())
        .then(data => {
            loginMessage.textContent = data.message;
            if (data.status === 'SUCCESS') {
                // Redirect after successful login
                window.location.href = '/user/dashboard';
            }
        })
        .catch(error => console.error('Error:', error));
    });

    signupForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const formData = new FormData(signupForm);
        const name = formData.get('name');
        const email = formData.get('email');
        const password = formData.get('password');
        const dateOfBirth = formData.get('dateOfBirth');

        fetch('/api/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password, dateOfBirth })
        })
        .then(response => response.json())
        .then(data => {
            signupMessage.textContent = data.message;
            if (data.status === 'PENDING') {
                // Redirect to waiting page
                window.location.href = "/waiting.html";
            }
        })
        .catch(error => console.error('Error:', error));
    });

    resetForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const formData = new FormData(resetForm);
        const email = formData.get('email');
        const redirectURL = window.location.href; // Assuming the reset link will redirect to the same page

        fetch('/api/resetPasswordReset', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, redirectURL })
        })
        .then(response => response.json())
        .then(data => {
            resetMessage.textContent = data.message;
            if (data.status === 'PENDING') {
                // Show message indicating reset email was sent
            }
        })
        .catch(error => console.error('Error:', error));
    });
});
