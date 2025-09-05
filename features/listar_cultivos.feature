Feature: Listar cultivos

  Background:
    Given abro WhatsApp Web y el chat "Twilio"

  Scenario: Listar cultivos
    When envio el comando para listar cultivos
    Then la lista del bot contiene cultivos
