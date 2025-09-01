using { API_BUSINESS_PARTNER as S4 } from './external/API_BUSINESS_PARTNER';

@path: '/remote'
service RemoteService {
  @readonly
  entity BusinessPartner as projection on S4.A_BusinessPartner {
    key BusinessPartner as ID,
    FirstName as firstName,
    LastName as lastName,
    BusinessPartnerName as name,
    to_BusinessPartnerAddress as addresses
  }
  
  @readonly
  entity BusinessPartnerAddress as projection on S4.A_BusinessPartnerAddress {
    BusinessPartner as ID,
    AddressID as addressId,
    to_EmailAddress as email,
    to_PhoneNumber as phoneNumber
  }
  
  @readonly
  entity EmailAddress as projection on S4.A_AddressEmailAddress {
    key AddressID as addressId,
    EmailAddress as email
  }
  
  @readonly
  entity PhoneNumber as projection on S4.A_AddressPhoneNumber {
    key AddressID as addressId,
    PhoneNumber as phone
  }
}