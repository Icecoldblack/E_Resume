package com.easepath.backend.model;

public class User {
    private String email;
    private String name;
    private String picture;
    
    public User() {
    }
    
    public User(String email, String name, String picture) {
        this.email = email;
        this.name = name;
        this.picture = picture;
    }
    
    public String getEmail() {
        return email;
    }
    
    public String getName() {
        return name;
    }
    
    public String getPicture() {
        return picture;
    }
    
    public void setEmail(String email) {
        this.email = email;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public void setPicture(String picture) {
        this.picture = picture;
    }
    
    // Builder pattern
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private String email;
        private String name;
        private String picture;
        
        public Builder email(String email) {
            this.email = email;
            return this;
        }
        
        public Builder name(String name) {
            this.name = name;
            return this;
        }
        
        public Builder picture(String picture) {
            this.picture = picture;
            return this;
        }
        
        public User build() {
            return new User(email, name, picture);
        }
    }
}
