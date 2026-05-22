-- Seed system-level WhatsApp config for OTP
INSERT INTO public.otp_whatsapp_config (
  exotel_sid,
  exotel_api_key,
  exotel_api_token,
  exotel_subdomain,
  whatsapp_source_number,
  is_active
) VALUES (
  'ecrtechnicalinnovations1',
  'c8db90a5c6402bd34af37520847a4fef3ef6bcdd4e342c9c',
  'b06e159031e0a55e71a599ac003d56ea62a91cf18f1c6b3b',
  'api.exotel.com',
  '919540178308',
  true
) ON CONFLICT DO NOTHING;
