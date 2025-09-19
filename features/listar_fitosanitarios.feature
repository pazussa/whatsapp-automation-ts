Feature: Listar productos fitosanitarios

  Background:
    Given abro WhatsApp Web y el chat "Twilio"

  Scenario: Listar productos fitosanitarios disponibles
    When envio el comando para listar productos fitosanitarios
    Then la lista del bot contiene productos fitosanitarios