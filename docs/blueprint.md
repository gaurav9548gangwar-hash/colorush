# **App Name**: Tiranga Wingo

## Core Features:

- Phone Authentication: Authenticate users via phone number and OTP using Firebase Authentication.
- Unique User ID Generation: Automatically generate a unique, email-like ID (e.g., user123@tiranga.in) for each user upon registration.
- Real-time Wallet Balance: Display the user's wallet balance in real-time, updated with bets and winnings.
- Deposit Requests: Allow users to submit deposit requests, including the deposit amount and a screenshot of the transaction; status tracked in Firestore.
- Withdrawal Requests: Allow users to submit withdrawal requests; status tracked in Firestore.
- Game Logic: Implement the core game logic for 'Win Go' games, including countdown timers, result generation, bet locking, and payout calculation. Random numbers must be truly random using a secure source.
- Admin Panel: Secure admin panel with user management, deposit/withdrawal approval, game control, and dashboard features, accessible only by the master admin.

## Style Guidelines:

- Background color: Dark Blue Gradient (#191970 to #2E294E) for an immersive feel.
- Primary color: Vibrant Blue (#3949AB) used for buttons and interactive elements.
- Accent color: Soft Gray (#B0BEC5) to complement primary elements.
- Body and headline font: 'PT Sans' sans-serif font; readable for body text; clear headlines.
- Use clear, minimalist icons for navigation and interactive elements, such as headphones, moon, and refresh icons.
- Maintain a consistent layout across all pages, including the game dashboard and admin panel, with clear sections for game modes, wallet information, and user interactions.
- Subtle animations on button hovers and transitions to enhance user experience.